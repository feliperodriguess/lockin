import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"
import type { AppSettings, MatchupNote } from "@/shared/types"

import { getDDragonBundle } from "./ddragon"
import { acceptReadyCheck, declineReadyCheck, getLcuSnapshot } from "./lcu"
import { deleteNote, getSettings, listNotes, setSettings, upsertNote } from "./store"

// ALL invoke handlers live here (CLAUDE.md). Channels not yet implemented
// still answer from the renderer's fake bridge via the progressive merge.
ipcMain.handle(IPC.LCU_GET_SNAPSHOT, () => getLcuSnapshot())

ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => setSettings(partial))

ipcMain.handle(IPC.ACCEPT_READY_CHECK, () => acceptReadyCheck())
ipcMain.handle(IPC.DECLINE_READY_CHECK, () => declineReadyCheck())

ipcMain.handle(IPC.DDRAGON_GET_BUNDLE, () => getDDragonBundle())

ipcMain.handle(IPC.NOTES_LIST, () => listNotes())
ipcMain.handle(IPC.NOTES_UPSERT, (_event, note: Partial<MatchupNote>) => upsertNote(note))
ipcMain.handle(IPC.NOTES_DELETE, (_event, id: string) => deleteNote(id))
