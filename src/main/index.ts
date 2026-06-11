import { join } from "node:path"

import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import { app, BrowserWindow, nativeImage, shell } from "electron"

import { IPC } from "@/shared/constants"
import type { GameflowPhase } from "@/shared/types"
import icon from "~/resources/icon.png"

import "./ipc"
import "./store"

import { getLcuSnapshot, startLcuService, startQueue, stopLcuService } from "./lcu"
import { getSettings, onSettingsChange, setSettings } from "./store"
import { createTray } from "./tray"

if (is.dev) {
	app.commandLine.appendSwitch("remote-debugging-port", "9223")
}

let mainWindow: BrowserWindow | null = null
let rebuildTray: (() => void) | null = null

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1320,
		height: 860,
		minWidth: 1000,
		minHeight: 600,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: "#17141f",
		titleBarStyle: "hiddenInset",
		...(process.platform === "linux" ? { icon } : {}),
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: false,
		},
	})

	mainWindow.on("ready-to-show", () => {
		mainWindow?.show()
	})

	mainWindow.on("closed", () => {
		mainWindow = null
	})

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url)
		return { action: "deny" }
	})

	if (is.dev && process.env.ELECTRON_RENDERER_URL) {
		mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
	}
}

function surfaceWindows(): void {
	if (!mainWindow) {
		createWindow()
		return
	}
	if (mainWindow.isMinimized()) mainWindow.restore()
	mainWindow.show()
	mainWindow.focus()
	if (process.platform === "darwin") {
		app.focus({ steal: true })
		app.dock?.bounce("informational")
	}
}

function navigateRenderer(to: string, search?: Record<string, unknown>): void {
	mainWindow?.webContents.send(IPC.NAV_GO, { to, search })
}

if (process.platform === "darwin") {
	app.dock?.setIcon(nativeImage.createFromDataURL(icon))
}

app.whenReady().then(() => {
	electronApp.setAppUserModelId("com.electron")

	app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window, { zoom: true })
	})

	createWindow()

	const trayHandle = createTray({
		getSnapshot: () => {
			const snap = getLcuSnapshot()
			return {
				connected: snap.connected,
				summoner: snap.summoner
					? { gameName: snap.summoner.gameName, tagLine: snap.summoner.tagLine }
					: null,
			}
		},
		getSettings: () => ({ autoAccept: getSettings().autoAccept }),
		setSettings: (partial) => {
			setSettings(partial)
		},
		startQueue: (queueId) => startQueue(queueId),
		surface: surfaceWindows,
		navigate: navigateRenderer,
		onChange: (rebuild) => {
			rebuildTray = rebuild
		},
	})

	const offSettings = onSettingsChange(() => {
		rebuildTray?.()
		const settings = getSettings()
		for (const w of BrowserWindow.getAllWindows()) {
			w.webContents.send(IPC.SETTINGS_CHANGED, settings)
		}
	})

	startLcuService((channel, payload) => {
		for (const w of BrowserWindow.getAllWindows()) {
			w.webContents.send(channel, payload)
		}
		if (channel === IPC.LCU_STATUS || channel === IPC.LCU_SUMMONER) {
			rebuildTray?.()
		}
		if (channel === IPC.LCU_PHASE && (payload as { phase: GameflowPhase }).phase === "ReadyCheck") {
			surfaceWindows()
		}
	})

	app.on("activate", () => {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})

	app.on("will-quit", () => {
		offSettings()
		trayHandle.unregister()
		stopLcuService()
	})
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})
