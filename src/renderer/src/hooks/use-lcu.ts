import { LcuLiveContext, LcuStatusContext } from "@renderer/providers/lcu-provider"
import { useContext } from "react"

import type { ChampSelectSession, GameflowPhase, ReadyCheck } from "@/shared/types"

export function useLcuStatus(): { connected: boolean } {
	const { connected } = useContext(LcuStatusContext)
	return { connected }
}

export function usePhase(): GameflowPhase {
	return useContext(LcuStatusContext).phase
}

export function useReadyCheck(): ReadyCheck | null {
	return useContext(LcuLiveContext).readyCheck
}

export function useChampSelectSession(): ChampSelectSession | null {
	return useContext(LcuLiveContext).champSelect
}
