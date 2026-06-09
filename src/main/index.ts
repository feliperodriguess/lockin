import { join } from "node:path"

import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import { app, BrowserWindow, nativeImage, shell } from "electron"

import { IPC } from "@/shared/constants"
import type { GameflowPhase } from "@/shared/types"
import icon from "~/resources/icon.png"

import "./ipc"
import "./store"

import { startLcuService, stopLcuService } from "./lcu"
import { createTray } from "./tray"

if (is.dev) {
	app.commandLine.appendSwitch("remote-debugging-port", "9223")
}

function createWindow(): void {
	const mainWindow = new BrowserWindow({
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

	createTray()

	mainWindow.on("ready-to-show", () => {
		mainWindow.show()
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
	for (const w of BrowserWindow.getAllWindows()) {
		if (w.isMinimized()) w.restore()
		w.show()
		w.focus()
	}
	if (process.platform === "darwin") {
		app.focus({ steal: true })
		app.dock?.bounce("informational")
	}
}

if (process.platform === "darwin") {
	app.dock?.setIcon(nativeImage.createFromDataURL(icon))
}

app.whenReady().then(() => {
	electronApp.setAppUserModelId("com.electron")

	app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window)
	})

	createWindow()

	startLcuService((channel, payload) => {
		for (const w of BrowserWindow.getAllWindows()) {
			w.webContents.send(channel, payload)
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
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})

app.on("will-quit", () => {
	stopLcuService()
})
