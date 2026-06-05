/* Sidebar + phaseSub helper — ported from app.jsx:223-349 */

import { useMatchRoute, useNavigate } from "@tanstack/react-router"
import { Activity, BookOpen, Settings } from "lucide-react"

import type { GameflowPhase } from "@/shared/types"

import { ConnectionIndicator } from "./connection-indicator"
import { Wordmark } from "./wordmark"

/* Maps LCU GameflowPhase → titlebar / sidebar sub-label.
   Uses GameflowPhase strings (not prototype scenario strings). */
export function phaseSub(connected: boolean, phase: GameflowPhase): string {
	if (!connected) return "Disconnected"
	if (phase === "ReadyCheck") return "Ready Check"
	if (phase === "ChampSelect") return "Champ Selection"
	return "Idle"
}

interface SidebarProps {
	connected: boolean
	phase: GameflowPhase
}

export function Sidebar({ connected, phase }: SidebarProps): React.JSX.Element {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()

	const isHome = !!matchRoute({ to: "/", fuzzy: false })
	const isNotes = !!matchRoute({ to: "/notes" })
	const isSettings = !!matchRoute({ to: "/settings" })

	const items = [
		{
			id: "live" as const,
			icon: <Activity size={16} style={{ flexShrink: 0 }} />,
			label: "Live",
			sub: phaseSub(connected, phase),
			active: isHome,
			onClick: () => navigate({ to: "/" }),
		},
		{
			id: "notes" as const,
			icon: <BookOpen size={16} style={{ flexShrink: 0 }} />,
			label: "Notes",
			sub: undefined,
			active: isNotes,
			onClick: () => navigate({ to: "/notes" }),
		},
		{
			id: "settings" as const,
			icon: <Settings size={16} style={{ flexShrink: 0 }} />,
			label: "Settings",
			sub: undefined,
			active: isSettings,
			onClick: () => navigate({ to: "/settings" }),
		},
	]

	return (
		<aside
			style={{
				width: 198,
				flexShrink: 0,
				background: "var(--bg-surface)",
				borderRight: "1px solid var(--stroke-default)",
				display: "flex",
				flexDirection: "column",
				padding: "14px 12px",
			}}
		>
			{/* wordmark block */}
			<div style={{ padding: "4px 8px 16px" }}>
				<Wordmark size={15} />
			</div>

			{/* nav items */}
			<nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
				{items.map((item) => (
					<SidebarItem
						key={item.id}
						icon={item.icon}
						label={item.label}
						sub={item.id === "live" ? item.sub : undefined}
						active={item.active}
						showDot={item.id === "live"}
						connected={connected}
						onClick={item.onClick}
					/>
				))}
			</nav>

			{/* spacer */}
			<div style={{ flex: 1 }} />

			{/* footer */}
			<div
				style={{
					borderTop: "1px solid var(--stroke-default)",
					paddingTop: 12,
					display: "flex",
					flexDirection: "column",
					gap: 6,
				}}
			>
				<ConnectionIndicator connected={connected} />
				<span
					style={{
						font: "400 10px/1 var(--font-mono)",
						color: "var(--fg-4)",
						paddingLeft: 16,
						whiteSpace: "nowrap",
					}}
				>
					{connected ? "LCU · 127.0.0.1" : "retrying every 2s…"}
				</span>
			</div>
		</aside>
	)
}

interface SidebarItemProps {
	icon: React.ReactNode
	label: string
	sub?: string
	active: boolean
	showDot?: boolean
	connected?: boolean
	onClick: () => void
}

function SidebarItem({
	icon,
	label,
	sub,
	active,
	showDot,
	connected,
	onClick,
}: SidebarItemProps): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			className="region-no-drag"
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "9px 10px",
				borderRadius: "var(--radius-sm)",
				cursor: "pointer",
				background: active ? "var(--bg-hover)" : "transparent",
				border: "1px solid",
				borderColor: active ? "var(--stroke-default)" : "transparent",
				color: active ? "var(--fg-1)" : "var(--fg-3)",
				textAlign: "left",
				transition:
					"background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)",
				position: "relative",
				width: "100%",
			}}
			onMouseEnter={(e) => {
				if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"
			}}
			onMouseLeave={(e) => {
				if (!active) e.currentTarget.style.background = "transparent"
			}}
		>
			{/* active accent bar — left:-12px is outside the button, clipped by aside padding */}
			{active && (
				<span
					style={{
						position: "absolute",
						left: -12,
						top: "50%",
						transform: "translateY(-50%)",
						width: 2.5,
						height: 18,
						background: "var(--color-accent)",
						borderRadius: 2,
					}}
				/>
			)}

			{icon}

			<span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
				<span style={{ font: "500 13px/1.1 var(--font-ui)" }}>{label}</span>
				{sub && (
					<span
						style={{
							font: "400 10px/1 var(--font-mono)",
							color: active ? "var(--color-accent)" : "var(--fg-4)",
							letterSpacing: "0.02em",
						}}
					>
						{sub}
					</span>
				)}
			</span>

			{showDot && (
				<span
					style={{
						width: 6,
						height: 6,
						borderRadius: 999,
						background: connected ? "var(--color-accent)" : "var(--color-ink-600)",
						flexShrink: 0,
					}}
				/>
			)}
		</button>
	)
}
