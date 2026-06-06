import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"
import type { AppSettings } from "@/shared/types"

import { getLcuSnapshot } from "./lcu"
import { getSettings, setSettings } from "./store"

// ALL invoke handlers live here (CLAUDE.md). Channels not yet implemented
// still answer from the renderer's fake bridge via the progressive merge.
ipcMain.handle(IPC.LCU_GET_SNAPSHOT, () => getLcuSnapshot())

ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => setSettings(partial))
