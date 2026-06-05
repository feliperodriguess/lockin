import { contextBridge } from "electron"

import type { Api } from "@/shared/api"

declare global {
	interface Window {
		api?: Partial<Api>
	}
}

// Real channels land here phase-by-phase (Phase 2: pushes for status/phase, …).
// getApi() in the renderer merges this over the fake bridge — real keys win.
const api: Partial<Api> = {}

if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("api", api)
	} catch (error) {
		console.error(error)
	}
} else {
	window.api = api
}
