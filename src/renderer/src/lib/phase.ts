import type { GameflowPhase } from "@/shared/types"

/* Maps LCU GameflowPhase → titlebar / sidebar sub-label. */
export function phaseSub(connected: boolean, phase: GameflowPhase): string {
	if (!connected) return "Disconnected"
	if (phase === "ReadyCheck") return "Ready Check"
	if (phase === "ChampSelect") return "Champ Selection"
	return "Idle"
}
