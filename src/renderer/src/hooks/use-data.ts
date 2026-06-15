import { api } from "@renderer/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	AppSettings,
	BanListEntry,
	BuildRecommendation,
	ChampionAbilities,
	CounterTable,
	MatchupNote,
} from "@/shared/types"

export function useDDragon() {
	return useQuery({
		queryKey: ["ddragon"],
		queryFn: () => api.getDDragonBundle(),
		staleTime: Infinity,
		gcTime: Infinity,
		// real network behind IPC (unlike the local-IPC queries the global
		// retry:false targets) — transient failures must not freeze the bundle
		retry: 3,
		retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
	})
}

export function useSettings() {
	return useQuery({ queryKey: ["settings"], queryFn: () => api.getSettings(), staleTime: Infinity })
}
export function useSetSettings() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (partial: Partial<AppSettings>) => api.setSettings(partial),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
	})
}

export function useNotes() {
	return useQuery({ queryKey: ["notes"], queryFn: () => api.listNotes(), staleTime: Infinity })
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
	return useQuery({ queryKey: ["banlist"], queryFn: () => api.getBanList(), staleTime: Infinity })
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
		queryKey: ["ranks", ...[...puuids].sort()],
		queryFn: () => api.getRanksForPuuids(puuids),
		enabled: puuids.length > 0,
		staleTime: Infinity,
	})
}

export function useTeamNames(puuids: string[]) {
	return useQuery({
		queryKey: ["names", ...[...puuids].sort()],
		queryFn: () => api.getNamesForPuuids(puuids),
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

export function useCounterTable(
	championKey: number | null,
	position: string | null,
	tier?: string,
) {
	return useQuery<CounterTable | null>({
		queryKey: ["counters", championKey, position, tier ?? null],
		queryFn: () => api.getCounters(championKey as number, position as string, tier),
		enabled: championKey != null && position != null,
		staleTime: Infinity,
	})
}

export function useChampionAbilities(championKey: number | null) {
	return useQuery<ChampionAbilities | null>({
		queryKey: ["abilities", championKey],
		queryFn: () => api.getChampionAbilities(championKey as number),
		enabled: championKey != null,
		staleTime: Infinity,
	})
}

export function useBuildRecommendation(
	championKey: number | null,
	position: string | null,
	tier?: string,
) {
	return useQuery<BuildRecommendation | null>({
		queryKey: ["build", championKey, position, tier ?? null],
		queryFn: () => api.getBuild(championKey as number, position as string, tier),
		enabled: championKey != null && position != null,
		staleTime: Infinity,
	})
}
