// champ-select-parts.jsx:516-599 — "Your team" region (single-column rail).
//   TeamRow per TeamRowVM: RoleGlyph (15, fg-4) + portrait (30, accent ring when
//   it's you) + name (600/12.5, accent + " (you)" when you) + champion caption
//   (mono 10, fg-4) + RankBadge sm — or an em-dash when the rank is null and it's
//   not you (your own rank always shows). The region's `right` slot prefers the
//   MismatchFlag, falling back to a neutral "Ranks unavailable" pill (WifiOff)
//   when no teammate rank is available. Rows are centered when fixed, top-aligned
//   when grown + scrolling.

import { Pill } from "@renderer/components/app/pill"
import { Section } from "@renderer/components/champ-select/section"
import { MismatchFlag } from "@renderer/components/game/badges"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { RankBadge } from "@renderer/components/game/rank-badge"
import { RoleGlyph } from "@renderer/components/game/role"
import type { TeamRowVM } from "@renderer/hooks/use-champ-select"
import { WifiOff } from "lucide-react"

interface TeamRegionProps {
	team: TeamRowVM[]
	ranksAvailable: boolean
	mismatch: boolean
	version: string
	grow?: boolean
}

export function TeamRegion({
	team,
	ranksAvailable,
	mismatch,
	version,
	grow,
}: TeamRegionProps): React.JSX.Element {
	return (
		<Section
			label="Your team"
			grow={grow}
			scroll={grow}
			right={
				mismatch ? (
					<MismatchFlag />
				) : !ranksAvailable ? (
					<Pill tone="neutral" icon={WifiOff}>
						Ranks unavailable
					</Pill>
				) : null
			}
		>
			<ul
				className="flex flex-1 flex-col"
				style={{ gap: 1, justifyContent: grow ? "flex-start" : "center" }}
			>
				{team.map((p) => (
					<TeamRow key={p.cellId} p={p} version={version} />
				))}
			</ul>
		</Section>
	)
}

function TeamRow({ p, version }: { p: TeamRowVM; version: string }): React.JSX.Element {
	// your own rank always renders; teammates show "—" when their rank is unknown
	const showRank = p.rank != null || p.you
	return (
		<li className="flex items-center" style={{ gap: 10, padding: "6px 4px" }}>
			<RoleGlyph role={p.role} size={15} color="var(--fg-4)" />
			<ChampionPortrait champion={p.champion} version={version} size={30} ring={p.you} />
			<div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
				<span
					className="overflow-hidden text-ellipsis whitespace-nowrap"
					style={{
						font: "600 12.5px/1 var(--font-ui)",
						color: p.you ? "var(--color-accent)" : "var(--fg-1)",
					}}
				>
					{p.name}
					{p.you ? " (you)" : ""}
				</span>
				<span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					{p.champion?.name}
				</span>
			</div>
			{showRank ? (
				<RankBadge rank={p.rank} size="sm" />
			) : (
				<span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>—</span>
			)}
		</li>
	)
}
