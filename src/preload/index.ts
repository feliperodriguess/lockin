import { contextBridge, ipcRenderer } from "electron"

import type { Api, Unsubscribe } from "@/shared/api"
import { IPC } from "@/shared/constants"
import type { LcuSnapshot } from "@/shared/types"

declare global {
	interface Window {
		api?: Partial<Api>
	}
}

/**
 * Push subscription honoring the Api contract: deliver the current value
 * immediately (from lcu:getSnapshot), then stream pushes. If a push lands
 * before the snapshot resolves, the snapshot is dropped — never regress to
 * older state.
 */
function subscribeWithSnapshot<T>(
	channel: string,
	cb: (payload: T) => void,
	fromSnapshot: (snap: LcuSnapshot) => T,
): Unsubscribe {
	let gotPush = false
	let unsubscribed = false
	const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
		gotPush = true
		cb(payload)
	}
	ipcRenderer.on(channel, listener)
	void ipcRenderer.invoke(IPC.LCU_GET_SNAPSHOT).then((snap: LcuSnapshot) => {
		if (!gotPush && !unsubscribed) cb(fromSnapshot(snap))
	})
	return () => {
		unsubscribed = true
		ipcRenderer.removeListener(channel, listener)
	}
}

// Real channels land here phase-by-phase (Phase 2: status/phase; Phase 3:
// settings + ready-check + champ-select). getApi() in the renderer merges
// this over the fake bridge — real keys win.
const api: Partial<Api> = {
	acceptReadyCheck: () => ipcRenderer.invoke(IPC.ACCEPT_READY_CHECK),
	declineReadyCheck: () => ipcRenderer.invoke(IPC.DECLINE_READY_CHECK),
	getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
	setSettings: (partial) => ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
	onLcuStatus: (cb) =>
		subscribeWithSnapshot(IPC.LCU_STATUS, cb, (s) => ({ connected: s.connected })),
	onGameflowPhase: (cb) => subscribeWithSnapshot(IPC.LCU_PHASE, cb, (s) => ({ phase: s.phase })),
	onReadyCheck: (cb) => subscribeWithSnapshot(IPC.LCU_READY_CHECK, cb, (s) => s.readyCheck),
	onChampSelect: (cb) => subscribeWithSnapshot(IPC.LCU_CHAMP_SELECT, cb, (s) => s.champSelect),
}

if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("api", api)
	} catch (error) {
		console.error(error)
	}
} else {
	window.api = api
}
