import { ChampSelectScreen } from "@renderer/components/champ-select/champ-select-screen"
import { Disconnected } from "@renderer/components/live/disconnected"
import { Idle } from "@renderer/components/live/idle"
import { ReadyCheckScreen } from "@renderer/components/ready-check/ready-check-screen"
import { useLcuStatus, usePhase } from "@renderer/hooks/use-lcu"

export function HomePage(): React.JSX.Element {
	const { connected } = useLcuStatus()
	const phase = usePhase()
	if (!connected) return <Disconnected />
	if (phase === "ReadyCheck") return <ReadyCheckScreen />
	if (phase === "ChampSelect") return <ChampSelectScreen />
	return <Idle />
}
