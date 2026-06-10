import { ChampSelectScreen } from "@renderer/components/champ-select/champ-select-screen"
import { InGameScreen } from "@renderer/components/game/in-game-screen"
import { Disconnected } from "@renderer/components/live/disconnected"
import { Idle } from "@renderer/components/live/idle"
import { useLcuStatus, usePhase } from "@renderer/hooks/use-lcu"

export function HomePage(): React.JSX.Element {
	const { connected } = useLcuStatus()
	const phase = usePhase()
	if (!connected) return <Disconnected />
	if (phase === "ChampSelect") return <ChampSelectScreen />
	if (phase === "InProgress" || phase === "GameStart") return <InGameScreen />
	return <Idle />
}
