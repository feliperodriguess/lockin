// champ-select-parts.jsx:64-228 — COMPACT (rail) variant only.
// Left: champion portrait (46, accent ring, radius 10) + name (600/16) + role
// (RoleTag when assigned, else warn "Role pending" chip) + summoner name (mono
// 11, fg-4, ellipsis); a 1px/40 divider; then the summoner-spell pair (32,
// showKeys, layout from settings) with a YourPickBadge beside it when the pair
// is pinned (PRD §6.1 — the rail has no Loadout card, so the "Your pick" label
// lives here). Right: phase label (mono 600/10 uppercase, warn at ≤10s) over a
// CountdownRing (54/5, value=secondsLeft, progress=secondsLeft/phaseTotal, warn
// + pulsing at ≤10). The demo advance button is dropped (the bridge drives the
// timer); the whole timer block is hidden when the phase is infinite.

import { Card } from "@renderer/components/app/card"
import { YourPickBadge } from "@renderer/components/game/badges"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { CountdownRing } from "@renderer/components/game/countdown-ring"
import { RoleTag } from "@renderer/components/game/role"
import { SpellPair } from "@renderer/components/game/spell-pair"
import type { ChampSelectVM } from "@renderer/hooks/use-champ-select"
import { CircleHelp } from "lucide-react"

interface HeaderStripProps {
	me: ChampSelectVM["me"]
	spells: ChampSelectVM["spells"]
	layout: "DF" | "FD"
	version: string
	subPhase: ChampSelectVM["subPhase"]
	secondsLeft: number
	phaseTotal: number
	timerVisible: boolean
}

export function HeaderStrip({
	me,
	spells,
	layout,
	version,
	subPhase,
	secondsLeft,
	phaseTotal,
	timerVisible,
}: HeaderStripProps): React.JSX.Element {
	const danger = secondsLeft <= 10
	const tone = danger ? "warn" : "accent"
	const showYourPick = spells.source === "pinned"

	return (
		<Card className="flex items-center justify-between p-4 gap-3 min-h-[78px]">
			<div className="flex min-w-0 items-center" style={{ gap: 12 }}>
				<ChampionPortrait champion={me.champion} version={version} size={46} ring />
				<div className="flex min-w-0 flex-col" style={{ gap: 6 }}>
					<div className="flex items-center" style={{ gap: 9 }}>
						<span
							style={{
								font: "600 16px/1 var(--font-ui)",
								color: "var(--fg-1)",
								letterSpacing: "-0.01em",
							}}
						>
							{me.champion?.name}
						</span>
					</div>
					<div className="flex min-w-0 items-center" style={{ gap: 8 }}>
						{me.role ? (
							<RoleTag role={me.role} active />
						) : (
							<span
								className="shrink-0"
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 5,
									font: "500 10px/1 var(--font-mono)",
									letterSpacing: "0.06em",
									textTransform: "uppercase",
									color: "var(--color-warn)",
									padding: "3px 8px",
									background: "var(--warn-bg)",
									borderRadius: "var(--radius-sm)",
								}}
							>
								<CircleHelp size={11} strokeWidth={2} />
								Role pending
							</span>
						)}
						<span
							className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
							style={{ font: "500 11px/1.3 var(--font-mono)", color: "var(--fg-4)" }}
						>
							{me.name}
						</span>
					</div>
				</div>
				<span
					className="shrink-0"
					style={{ width: 1, height: 40, background: "var(--stroke-default)" }}
				/>
				<div className="flex shrink-0 items-center" style={{ gap: 8 }}>
					<SpellPair pair={spells.pair} version={version} layout={layout} size={32} showKeys />
					{showYourPick && <YourPickBadge />}
				</div>
			</div>

			{timerVisible && (
				<div className="flex shrink-0 items-center" style={{ gap: 10 }}>
					<div className="flex flex-col items-end" style={{ gap: 5 }}>
						<span
							style={{
								font: "600 10px/1 var(--font-mono)",
								letterSpacing: "0.14em",
								textTransform: "uppercase",
								color: danger ? "var(--color-warn)" : "var(--fg-3)",
							}}
						>
							{subPhase === "ban" ? "Ban phase" : "Pick phase"}
						</span>
					</div>
					<CountdownRing
						size={54}
						stroke={5}
						progress={secondsLeft / phaseTotal}
						tone={tone}
						value={secondsLeft}
						sub=""
						pulsing={danger}
					/>
				</div>
			)}
		</Card>
	)
}
