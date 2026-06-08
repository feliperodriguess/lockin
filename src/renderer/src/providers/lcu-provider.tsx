import { api } from "@renderer/api"
import { createContext, useEffect, useMemo, useReducer } from "react"

import type { ChampSelectSession, GameflowPhase, ReadyCheck } from "@/shared/types"

export interface LcuStatusState {
	connected: boolean
	phase: GameflowPhase
}
export interface LcuLiveState {
	readyCheck: ReadyCheck | null
	champSelect: ChampSelectSession | null
}

export const LcuStatusContext = createContext<LcuStatusState>({ connected: false, phase: "None" })
export const LcuLiveContext = createContext<LcuLiveState>({ readyCheck: null, champSelect: null })

type LcuState = LcuStatusState & LcuLiveState
type LcuEvent =
	| { type: "status"; connected: boolean }
	| { type: "phase"; phase: GameflowPhase }
	| { type: "readyCheck"; readyCheck: ReadyCheck | null }
	| { type: "champSelect"; champSelect: ChampSelectSession | null }

function reducer(state: LcuState, e: LcuEvent): LcuState {
	switch (e.type) {
		case "status":
			return { ...state, connected: e.connected }
		case "phase":
			return { ...state, phase: e.phase }
		case "readyCheck":
			return { ...state, readyCheck: e.readyCheck }
		case "champSelect":
			return { ...state, champSelect: e.champSelect }
	}
}

export function LcuProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
	const [state, dispatch] = useReducer(reducer, {
		connected: false,
		phase: "None",
		readyCheck: null,
		champSelect: null,
	})

	// LOGGING (DEV only)
	useEffect(() => {
		const log = (e: LcuEvent): void => {
			if (import.meta.env.DEV && (e.type === "status" || e.type === "phase")) {
				console.log(`[lcu-provider] ${JSON.stringify(e)}`)
			}
			dispatch(e)
		}
		const offs = [
			api.onLcuStatus(({ connected }) => log({ type: "status", connected })),
			api.onGameflowPhase(({ phase }) => log({ type: "phase", phase })),
			api.onReadyCheck((readyCheck) => log({ type: "readyCheck", readyCheck })),
			api.onChampSelect((champSelect) => log({ type: "champSelect", champSelect })),
		]
		return () => {
			for (const off of offs) off()
		}
	}, [])

	const statusValue = useMemo(
		() => ({ connected: state.connected, phase: state.phase }),
		[state.connected, state.phase],
	)
	const liveValue = useMemo(
		() => ({ readyCheck: state.readyCheck, champSelect: state.champSelect }),
		[state.readyCheck, state.champSelect],
	)

	return (
		<LcuStatusContext.Provider value={statusValue}>
			<LcuLiveContext.Provider value={liveValue}>{children}</LcuLiveContext.Provider>
		</LcuStatusContext.Provider>
	)
}
