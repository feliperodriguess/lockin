import { api } from "@renderer/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { AppSettings, BanListEntry, MatchupNote } from "@/shared/types"

export function useDDragon() {
	return useQuery({
		queryKey: ["ddragon"],
		queryFn: api.getDDragonBundle,
		staleTime: Infinity,
		gcTime: Infinity,
	})
}

export function useSettings() {
	return useQuery({ queryKey: ["settings"], queryFn: api.getSettings, staleTime: Infinity })
}
export function useSetSettings() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (partial: Partial<AppSettings>) => api.setSettings(partial),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
	})
}

export function useNotes() {
	return useQuery({ queryKey: ["notes"], queryFn: api.listNotes, staleTime: Infinity })
}
export function useUpsertNote() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (note: Partial<MatchupNote>) => api.upsertNote(note),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
	})
}
export function useDeleteNote() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => api.deleteNote(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
	})
}

export function useBanList() {
	return useQuery({ queryKey: ["banlist"], queryFn: api.getBanList, staleTime: Infinity })
}
export function useSetBanList() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (entries: BanListEntry[]) => api.setBanList(entries),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["banlist"] }),
	})
}

export function useTeamRanks(puuids: string[]) {
	return useQuery({
		queryKey: ["ranks", ...puuids],
		queryFn: () => api.getRanksForPuuids(puuids),
		enabled: puuids.length > 0,
		staleTime: Infinity,
	})
}

export function useAcceptReadyCheck() {
	return useMutation({ mutationFn: () => api.acceptReadyCheck() })
}
export function useDeclineReadyCheck() {
	return useMutation({ mutationFn: () => api.declineReadyCheck() })
}
