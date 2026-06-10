import {
	app,
	globalShortcut,
	Menu,
	type MenuItemConstructorOptions,
	Notification,
	nativeImage,
	Tray,
} from "electron"

import trayIcon from "~/resources/lockinTemplate.png"

import { RANKED_QUEUE_ID } from "./lcu-mappers"

const AUTO_ACCEPT_ACCELERATOR = "Control+Alt+A"

export const QUEUE_ACTIONS: { label: string; queueId: number }[] = [
	{ label: "Start ranked queue", queueId: RANKED_QUEUE_ID.SOLO_DUO },
	{ label: "Start flex queue", queueId: RANKED_QUEUE_ID.FLEX },
]

export interface TraySnapshot {
	connected: boolean
	summoner: { gameName: string; tagLine: string } | null
}

export interface TrayDeps {
	/** Current connection + identity for the header. */
	getSnapshot: () => TraySnapshot
	/** Current persisted settings (for the auto-accept checkbox state). */
	getSettings: () => { autoAccept: boolean }
	/** Persist a settings change (toggling auto-accept). */
	setSettings: (partial: { autoAccept: boolean }) => void
	/** Start a queue by id; resolves ok/error like the LCU service. */
	startQueue: (queueId: number) => Promise<{ ok: boolean; error?: string }>
	/** Focus/restore + show the main window. */
	surface: () => void
	/** Push a renderer navigation (tray-driven). */
	navigate: (to: string, search?: Record<string, unknown>) => void
	/** Re-run the supplied callback whenever status/summoner/settings change. */
	onChange: (rebuild: () => void) => void
}

function notifyQueueError(label: string, error?: string): void {
	if (!Notification.isSupported()) return
	new Notification({ title: "lockin", body: queueErrorMessage(label, error) }).show()
}

export function createTray(deps: TrayDeps): { unregister: () => void } {
	const icon = nativeImage.createFromDataURL(trayIcon)
	const tray = new Tray(icon)

	const toggleAutoAccept = (): void => {
		deps.setSettings({ autoAccept: !deps.getSettings().autoAccept })
		rebuild()
	}

	const startQueue = (label: string, queueId: number): void => {
		deps.surface()
		void deps
			.startQueue(queueId)
			.then((result) => {
				if (!result.ok) notifyQueueError(label, result.error)
			})
			.catch((error: unknown) => {
				notifyQueueError(label, error instanceof Error ? error.message : undefined)
			})
	}

	function rebuild(): void {
		const snapshot = deps.getSnapshot()
		const settings = deps.getSettings()

		const queueItems: MenuItemConstructorOptions[] = QUEUE_ACTIONS.map((action) => ({
			label: action.label,
			enabled: snapshot.connected,
			click: () => startQueue(action.label, action.queueId),
		}))

		const template: MenuItemConstructorOptions[] = [
			{ label: identityLabel(snapshot), enabled: false },
			{ type: "separator" },
			{
				label: "Auto-accept ready check",
				type: "checkbox",
				checked: settings.autoAccept,
				accelerator: AUTO_ACCEPT_ACCELERATOR,
				registerAccelerator: false, // we own the global shortcut explicitly below
				click: toggleAutoAccept,
			},
			{ type: "separator" },
			...queueItems,
			{ type: "separator" },
			{
				label: "New note…",
				click: () => {
					deps.surface()
					deps.navigate("/notes", { new: true })
				},
			},
			{ label: "Open lockin", click: () => deps.surface() },
			{ type: "separator" },
			{ label: "Quit lockin", click: () => app.quit() },
		]

		tray.setContextMenu(Menu.buildFromTemplate(template))
	}

	rebuild()
	deps.onChange(rebuild)

	const registered = globalShortcut.register(AUTO_ACCEPT_ACCELERATOR, toggleAutoAccept)
	if (!registered) console.warn(`[tray] failed to register ${AUTO_ACCEPT_ACCELERATOR}`)

	return {
		unregister: () => {
			globalShortcut.unregister(AUTO_ACCEPT_ACCELERATOR)
		},
	}
}

function identityLabel(snapshot: TraySnapshot): string {
	if (!snapshot.connected) return "○ Client not detected"
	const id = snapshot.summoner
	if (!id) return "● Connected"
	return `● ${id.gameName}#${id.tagLine}`
}

/** Human-readable notification body when a tray queue-start fails. */
export function queueErrorMessage(label: string, error?: string): string {
	if (error) return `${label} failed: ${error}`
	return `${label} failed. Check the League client and try again.`
}
