import { LcuLiveContext, LcuStatusContext } from "@renderer/providers/lcu-provider"
import { useContext } from "react"

import type {
	ChampSelectSession,
	GameflowPhase,
	InGameState,
	ReadyCheck,
	SummonerIdentity,
} from "@/shared/types"

export function useLcuStatus(): { connected: boolean } {
	const { connected } = useContext(LcuStatusContext)
	return { connected }
}

export function usePhase(): GameflowPhase {
	return useContext(LcuStatusContext).phase
}

export function useSummoner(): SummonerIdentity | null {
	return useContext(LcuStatusContext).summoner
}

export function useReadyCheck(): ReadyCheck | null {
	return useContext(LcuLiveContext).readyCheck
}

export function useChampSelectSession(): ChampSelectSession | null {
	return useContext(LcuLiveContext).champSelect
}

export function useInGame(): InGameState | null {
	return useContext(LcuLiveContext).inGame
}
