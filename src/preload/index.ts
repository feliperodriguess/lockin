import { contextBridge, ipcRenderer } from "electron"

declare global {
	interface Window {
		api: typeof api
	}
}

const api = {
	ping(message: string): Promise<string> {
		return ipcRenderer.invoke("ping", message)
	},
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
