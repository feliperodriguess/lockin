import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"
import type { AppSettings, BanListEntry, MatchupNote, RunePageRec } from "@/shared/types"

import { getBuild, getCounters } from "./build-recommendations/opgg"
import { getChampionAbilities, getDDragonBundle } from "./ddragon"
import {
	acceptReadyCheck,
	applyRunePage,
	declineReadyCheck,
	getLcuSnapshot,
	getNamesForPuuids,
	getRanksForPuuids,
	setSummonerSpells,
	startQueue,
	stopQueue,
} from "./lcu"
import {
	deleteNote,
	getBanList,
	getSettings,
	listNotes,
	setBanList,
	setSettings,
	upsertNote,
} from "./store"

ipcMain.handle(IPC.LCU_GET_SNAPSHOT, () => getLcuSnapshot())

ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => setSettings(partial))

ipcMain.handle(IPC.ACCEPT_READY_CHECK, () => acceptReadyCheck())
ipcMain.handle(IPC.DECLINE_READY_CHECK, () => declineReadyCheck())

ipcMain.handle(IPC.DDRAGON_GET_BUNDLE, () => getDDragonBundle())
ipcMain.handle(IPC.DDRAGON_GET_ABILITIES, (_event, championKey: number) =>
	getChampionAbilities(championKey),
)

ipcMain.handle(IPC.NOTES_LIST, () => listNotes())
ipcMain.handle(IPC.NOTES_UPSERT, (_event, note: Partial<MatchupNote>) => upsertNote(note))
ipcMain.handle(IPC.NOTES_DELETE, (_event, id: string) => deleteNote(id))

ipcMain.handle(IPC.BANLIST_GET, () => getBanList())
ipcMain.handle(IPC.BANLIST_SET, (_event, entries: BanListEntry[]) => setBanList(entries))

ipcMain.handle(IPC.RANK_GET_FOR_PUUIDS, (_event, puuids: string[]) => getRanksForPuuids(puuids))
ipcMain.handle(IPC.NAME_GET_FOR_PUUIDS, (_event, puuids: string[]) => getNamesForPuuids(puuids))

ipcMain.handle(IPC.BUILD_GET, (_event, championKey: number, position: string, tier?: string) =>
	getBuild(championKey, position, tier),
)

ipcMain.handle(IPC.COUNTERS_GET, (_event, championKey: number, position: string, tier?: string) =>
	getCounters(championKey, position, tier),
)

ipcMain.handle(IPC.LCU_SET_SPELLS, (_event, spell1Id: number, spell2Id: number) =>
	setSummonerSpells(spell1Id, spell2Id),
)
ipcMain.handle(IPC.LCU_APPLY_RUNES, (_event, page: RunePageRec, championName?: string) =>
	applyRunePage(page, championName),
)
ipcMain.handle(IPC.LCU_START_QUEUE, (_event, queueId: number) => startQueue(queueId))
ipcMain.handle(IPC.LCU_STOP_QUEUE, () => stopQueue())
