import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"

import { getLcuSnapshot } from "./lcu"

// ALL invoke handlers live here (CLAUDE.md). Channels not yet implemented
// still answer from the renderer's fake bridge via the progressive merge.
ipcMain.handle(IPC.LCU_GET_SNAPSHOT, () => getLcuSnapshot())
