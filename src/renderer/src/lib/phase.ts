import type { GameflowPhase } from "@/shared/types"

/* Maps LCU GameflowPhase → titlebar / sidebar sub-label. */
export function phaseSub(connected: boolean, phase: GameflowPhase): string {
	if (!connected) return "Disconnected"
	if (phase === "ReadyCheck") return "Ready Check"
	if (phase === "ChampSelect") return "Champ Select"
	if (phase === "Matchmaking") return "In Queue"
	if (phase === "Lobby") return "In Lobby"
	if (phase === "InProgress" || phase === "GameStart") return "In Game"
	return "Idle"
}
