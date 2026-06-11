import { Section } from "@renderer/components/champ-select/section"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import type { CounterPicksVM, CounterPickVM } from "@renderer/hooks/use-champ-select"
import { formatWinRate } from "@renderer/lib/build-format"

interface CounterPicksRegionProps {
	picks: CounterPicksVM
	version: string
}

export function CounterPicksRegion({ picks, version }: CounterPicksRegionProps): React.JSX.Element {
	return (
		<Section label={`Counter picks · vs ${picks.opponent.name}`}>
			<div className="flex flex-col gap-[10px]">
				{picks.yours.length > 0 && (
					<PickRow label="Your picks" picks={picks.yours} version={version} />
				)}
				{picks.best.length > 0 && (
					<PickRow label="Best overall" picks={picks.best} version={version} />
				)}
			</div>
		</Section>
	)
}

function PickRow({
	label,
	picks,
	version,
}: {
	label: string
	picks: CounterPickVM[]
	version: string
}): React.JSX.Element {
	return (
		<div className="flex flex-col gap-[6px]">
			<span className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.06em] text-paper-400">
				{label}
			</span>
			<ul className="m-0 flex flex-wrap gap-[10px] p-0">
				{picks.map((p, i) => (
					<li
						key={p.champion?.key ?? i}
						title={p.champion?.name}
						className="flex flex-col items-center gap-[4px]"
					>
						<ChampionPortrait champion={p.champion} version={version} size={32} />
						<span className="font-mono text-[10px] leading-none text-paper-300">
							{formatWinRate(p.winRate)}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}
