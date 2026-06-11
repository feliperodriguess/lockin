import { phaseSub } from "@renderer/lib/phase"
import { cn } from "@renderer/lib/utils"
import { useMatchRoute, useNavigate } from "@tanstack/react-router"
import { Activity, BookOpen, Settings } from "lucide-react"

import type { GameflowPhase } from "@/shared/types"

import { ConnectionIndicator } from "./connection-indicator"
import { SidebarIdentity } from "./sidebar-identity"
import { Wordmark } from "./wordmark"

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
			icon: <Activity size={16} className="shrink-0" />,
			label: "Live",
			sub: phaseSub(connected, phase),
			active: isHome,
			onClick: () => navigate({ to: "/" }),
		},
		{
			id: "notes" as const,
			icon: <BookOpen size={16} className="shrink-0" />,
			label: "Notes",
			sub: undefined,
			active: isNotes,
			onClick: () => navigate({ to: "/notes" }),
		},
		{
			id: "settings" as const,
			icon: <Settings size={16} className="shrink-0" />,
			label: "Settings",
			sub: undefined,
			active: isSettings,
			onClick: () => navigate({ to: "/settings" }),
		},
	]

	return (
		<aside className="w-[198px] shrink-0 bg-ink-900 border-r border-(--stroke-default) flex flex-col p-[14px_12px]">
			<div className="px-2 pt-1 pb-4">
				<Wordmark size={15} />
			</div>

			<nav className="flex flex-col gap-[3px]">
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

			<div className="flex-1" />

			<footer className="border-t border-(--stroke-default) pt-3 flex flex-col gap-2 px-2">
				<SidebarIdentity />
				<ConnectionIndicator connected={connected} />
				{connected && (
					<span className="font-mono text-[10px] font-normal leading-none text-paper-400 pl-4 whitespace-nowrap">
						LCU · 127.0.0.1
					</span>
				)}
			</footer>
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
			aria-current={active ? "page" : undefined}
			className={cn(
				"region-no-drag relative flex items-center gap-[10px] w-full",
				"px-[10px] py-[9px] rounded-sm cursor-pointer border text-left",
				"transition-[background-color,color] duration-(--dur-base) ease-(--ease-standard)",
				active
					? "bg-ink-800 border-(--stroke-default) text-paper-100"
					: "bg-transparent border-transparent text-paper-300 hover:bg-[rgba(255,255,255,0.03)]",
			)}
		>
			{/* active accent bar — left:-12px is outside the button, clipped by aside padding */}
			{active && (
				<span className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-[2.5px] h-[18px] bg-accent rounded-[2px]" />
			)}

			{icon}

			<span className="flex-1 flex flex-col gap-px">
				<span className="text-[13px] font-medium leading-[1.1]">{label}</span>
				{sub && (
					<span
						className={cn(
							"font-mono text-[10px] font-normal leading-none tracking-[0.02em]",
							active ? "text-accent" : "text-paper-400",
						)}
					>
						{sub}
					</span>
				)}
			</span>

			{showDot && (
				<span
					className={cn(
						"w-[6px] h-[6px] rounded-full shrink-0",
						connected ? "bg-accent" : "bg-ink-600",
					)}
				/>
			)}
		</button>
	)
}
