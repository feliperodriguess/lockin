import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"

ipcMain.handle(IPC.PING, async (_, message: string): Promise<string> => {
	return message
})
