import { api } from "@renderer/api"
import { createContext, useEffect, useMemo, useReducer } from "react"

import type {
	ChampSelectSession,
	GameflowPhase,
	InGameState,
	ReadyCheck,
	SummonerIdentity,
} from "@/shared/types"

export interface LcuStatusState {
	connected: boolean
	phase: GameflowPhase
	summoner: SummonerIdentity | null
}
export interface LcuLiveState {
	readyCheck: ReadyCheck | null
	champSelect: ChampSelectSession | null
	inGame: InGameState | null
}

export const LcuStatusContext = createContext<LcuStatusState>({
	connected: false,
	phase: "None",
	summoner: null,
})
export const LcuLiveContext = createContext<LcuLiveState>({
	readyCheck: null,
	champSelect: null,
	inGame: null,
})

type LcuState = LcuStatusState & LcuLiveState
type LcuEvent =
	| { type: "status"; connected: boolean }
	| { type: "phase"; phase: GameflowPhase }
	| { type: "summoner"; summoner: SummonerIdentity | null }
	| { type: "readyCheck"; readyCheck: ReadyCheck | null }
	| { type: "champSelect"; champSelect: ChampSelectSession | null }
	| { type: "inGame"; inGame: InGameState | null }

function reducer(state: LcuState, e: LcuEvent): LcuState {
	switch (e.type) {
		case "status":
			return { ...state, connected: e.connected }
		case "phase":
			return { ...state, phase: e.phase }
		case "summoner":
			return { ...state, summoner: e.summoner }
		case "readyCheck":
			return { ...state, readyCheck: e.readyCheck }
		case "champSelect":
			return { ...state, champSelect: e.champSelect }
		case "inGame":
			return { ...state, inGame: e.inGame }
	}
}

export function LcuProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
	const [state, dispatch] = useReducer(reducer, {
		connected: false,
		phase: "None",
		summoner: null,
		readyCheck: null,
		champSelect: null,
		inGame: null,
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
			api.onSummoner((summoner) => log({ type: "summoner", summoner })),
			api.onReadyCheck((readyCheck) => log({ type: "readyCheck", readyCheck })),
			api.onChampSelect((champSelect) => log({ type: "champSelect", champSelect })),
			api.onInGame((inGame) => log({ type: "inGame", inGame })),
		]
		return () => {
			for (const off of offs) off()
		}
	}, [])

	const statusValue = useMemo(
		() => ({ connected: state.connected, phase: state.phase, summoner: state.summoner }),
		[state.connected, state.phase, state.summoner],
	)
	const liveValue = useMemo(
		() => ({
			readyCheck: state.readyCheck,
			champSelect: state.champSelect,
			inGame: state.inGame,
		}),
		[state.readyCheck, state.champSelect, state.inGame],
	)

	return (
		<LcuStatusContext.Provider value={statusValue}>
			<LcuLiveContext.Provider value={liveValue}>{children}</LcuLiveContext.Provider>
		</LcuStatusContext.Provider>
	)
}
