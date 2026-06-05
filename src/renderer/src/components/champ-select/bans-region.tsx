// champ-select-parts.jsx:399-513 — "Ban suggestions" region.
//   BanRow per BanRowVM: portrait (dim when gone) + name (strikethrough+fg-3 when
//   gone) + ThreatBadge (when threat && !enemyHidden) + reason line + status
//   caption (Open=accent / Banned|Picked=fg-4). Visible-threat rows get a
//   fail-tinted bg + border; gone rows fade to 0.42.
//   The region's `right` slot shows "N/M gone".
//   Pick phase collapses the whole region to a clickable "Ban phase complete ·
//   N of your targets gone" card; collapse state lives here and flips when the
//   sub-phase changes (pick → collapsed). The collapsed card and a chevron-up in
//   the expanded header (pick phase only) both toggle it.
//   Empty ban list → compact EmptyState + "Manage ban list" → /settings.

import { Card } from "@renderer/components/app/card"
import { EmptyState } from "@renderer/components/app/empty-state"
import { Section } from "@renderer/components/champ-select/section"
import { ThreatBadge } from "@renderer/components/game/badges"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { Button } from "@renderer/components/ui/button"
import type { BanRowVM } from "@renderer/hooks/use-champ-select"
import { useNavigate } from "@tanstack/react-router"
import { ChevronDown, ChevronUp, Shield } from "lucide-react"
import { useEffect, useState } from "react"

interface BansRegionProps {
	banRows: BanRowVM[]
	goneCount: number
	enemyHidden: boolean
	subPhase: "ban" | "pick"
	version: string
	grow?: boolean
}

export function BansRegion({
	banRows,
	goneCount,
	enemyHidden,
	subPhase,
	version,
	grow,
}: BansRegionProps): React.JSX.Element {
	// collapse on the pick phase, expand on the ban phase (subPhase is referenced
	// in the effect body → biome's exhaustive-deps autofix leaves it alone)
	const [collapsed, setCollapsed] = useState(subPhase === "pick")
	useEffect(() => {
		setCollapsed(subPhase === "pick")
	}, [subPhase])

	if (banRows.length === 0) {
		return (
			<Section label="Ban suggestions" grow={grow}>
				<EmptyBanList />
			</Section>
		)
	}

	if (collapsed) {
		return <CollapsedBans goneCount={goneCount} onToggle={() => setCollapsed(false)} />
	}

	return (
		<Section
			label="Ban suggestions"
			grow={grow}
			scroll
			right={
				<div className="flex items-center" style={{ gap: 8 }}>
					<span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{goneCount}/{banRows.length} gone
					</span>
					{subPhase === "pick" && (
						<button
							type="button"
							title="Collapse"
							onClick={() => setCollapsed(true)}
							className="inline-flex items-center justify-center"
							style={{
								color: "var(--fg-4)",
								background: "none",
								border: "none",
								cursor: "pointer",
							}}
						>
							<ChevronUp size={15} />
						</button>
					)}
				</div>
			}
		>
			<ul className="flex flex-col" style={{ gap: 2 }}>
				{banRows.map((row) => (
					<BanRow key={row.championId} row={row} enemyHidden={enemyHidden} version={version} />
				))}
			</ul>
		</Section>
	)
}

function BanRow({
	row,
	enemyHidden,
	version,
}: {
	row: BanRowVM
	enemyHidden: boolean
	version: string
}): React.JSX.Element {
	const gone = row.status === "banned" || row.status === "picked"
	const showThreat = row.threat && !enemyHidden
	return (
		<li
			className="flex items-center"
			style={{
				gap: 10,
				padding: "7px 9px",
				borderRadius: "var(--radius-sm)",
				background: showThreat ? "var(--fail-bg)" : "transparent",
				border: showThreat ? "1px solid rgba(255,107,94,0.22)" : "1px solid transparent",
				opacity: gone ? 0.42 : 1,
			}}
		>
			<ChampionPortrait champion={row.champion} version={version} size={30} dim={gone} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center" style={{ gap: 7 }}>
					<span
						style={{
							font: "600 13px/1 var(--font-ui)",
							color: gone ? "var(--fg-3)" : "var(--fg-1)",
							textDecoration: gone ? "line-through" : "none",
						}}
					>
						{row.champion?.name}
					</span>
					{showThreat && <ThreatBadge />}
				</div>
				{row.reason && (
					<div
						className="overflow-hidden text-ellipsis whitespace-nowrap"
						style={{ font: "400 11px/1.3 var(--font-ui)", color: "var(--fg-4)", marginTop: 2 }}
					>
						{row.reason}
					</div>
				)}
			</div>
			<span
				className="shrink-0"
				style={{
					font: "500 9px/1 var(--font-mono)",
					letterSpacing: "0.06em",
					textTransform: "uppercase",
					color: gone ? "var(--fg-4)" : "var(--color-accent)",
				}}
			>
				{row.status === "banned" ? "Banned" : row.status === "picked" ? "Picked" : "Open"}
			</span>
		</li>
	)
}

function CollapsedBans({
	goneCount,
	onToggle,
}: {
	goneCount: number
	onToggle: () => void
}): React.JSX.Element {
	return (
		<Card hover onClick={onToggle} className="flex items-center justify-between px-4 py-[11.2px]">
			<div className="flex items-center" style={{ gap: 9 }}>
				<Shield size={15} strokeWidth={2} style={{ color: "var(--fg-3)" }} />
				<span style={{ font: "500 12.5px/1 var(--font-ui)", color: "var(--fg-2)" }}>
					Ban phase complete
				</span>
				<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					{goneCount} of your targets gone
				</span>
			</div>
			<ChevronDown size={15} strokeWidth={2} style={{ color: "var(--fg-4)" }} />
		</Card>
	)
}

function EmptyBanList(): React.JSX.Element {
	const navigate = useNavigate()
	return (
		<div className="flex flex-1 items-center justify-center">
			<EmptyState
				icon={Shield}
				compact
				title="Your ban list is empty"
				line="Add the champions you never want to face."
				action={
					<Button variant="ghost" size="sm" onClick={() => navigate({ to: "/settings" })}>
						Manage ban list
					</Button>
				}
			/>
		</div>
	)
}
