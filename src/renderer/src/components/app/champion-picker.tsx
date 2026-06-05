// components.jsx:256-451 — ChampionPicker combobox.
// Trigger button (portrait or dashed placeholder + name + optional clear X + ChevronDown),
// dropdown (search input + scrollable list with portraits + champion title 9px mono fg-4),
// click-outside close, "No champions match".

import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { Input } from "@renderer/components/ui/input"
import { cn } from "@renderer/lib/utils"
import { ChevronDown, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { DDragonBundle } from "@/shared/types"

interface ChampionPickerProps {
	value: number | null
	onChange: (id: number | null) => void
	bundle: DDragonBundle
	version: string
	placeholder?: string
	allowClear?: boolean
	size?: "sm" | "md"
	excludeIds?: number[]
}

export function ChampionPicker({
	value,
	onChange,
	bundle,
	version,
	placeholder = "Select champion",
	allowClear,
	size = "md",
	excludeIds = [],
}: ChampionPickerProps): React.JSX.Element {
	const [open, setOpen] = useState(false)
	const [q, setQ] = useState("")
	const ref = useRef<HTMLDivElement>(null)

	// click-outside close
	useEffect(() => {
		const h = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", h)
		return () => document.removeEventListener("mousedown", h)
	}, [])

	// Sorted champion list excluding banned ids
	const allChamps = Object.values(bundle.championsByKey)
		.filter((c) => !excludeIds.includes(c.key))
		.sort((a, b) => a.name.localeCompare(b.name))

	const list = allChamps.filter(
		(c) =>
			c.name.toLowerCase().includes(q.toLowerCase()) ||
			c.id.toLowerCase().includes(q.toLowerCase()),
	)

	const sel = value != null ? (bundle.championsByKey[value] ?? null) : null
	const h = size === "sm" ? 32 : 36
	const portraitSize = h - 12

	return (
		<div ref={ref} className="relative">
			{/* Wrapper so the clear X button can sit alongside the trigger without nesting */}
			<div className="relative">
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					className={cn(
						"flex items-center gap-[9px] w-full text-left cursor-pointer",
						"bg-ink-950 border rounded-sm",
						"transition-[border-color,box-shadow] duration-[160ms] ease-[var(--ease-standard)]",
						"text-paper-100",
						open
							? "border-accent shadow-[0_0_0_1px_var(--color-accent),0_0_16px_var(--accent-glow)]"
							: "border-[var(--stroke-default)]",
						// dynamic: height and padding depend on size prop
					)}
					// dynamic: height and padding derived from `size` prop
					style={{ height: h, padding: allowClear && sel ? "0 28px 0 8px" : "0 10px 0 8px" }}
				>
					{sel ? (
						<ChampionPortrait champion={sel} version={version} size={portraitSize} />
					) : (
						<span
							className="shrink-0 block rounded-xs border border-dashed border-[var(--stroke-strong)]"
							// dynamic: size derived from `size` prop
							style={{ width: portraitSize, height: portraitSize }}
						/>
					)}
					<span
						className={cn(
							"flex-1 text-[13px] font-medium leading-none",
							sel ? "text-paper-100" : "text-paper-400",
						)}
					>
						{sel ? sel.name : placeholder}
					</span>
					<ChevronDown size={14} className="text-paper-300 shrink-0" />
				</button>

				{/* Clear X — sibling of trigger, absolutely positioned to avoid nested button */}
				{allowClear && sel && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							onChange(null)
						}}
						className="absolute right-7 top-1/2 -translate-y-1/2 flex text-paper-400 p-0.5 cursor-pointer bg-none border-none z-[1]"
					>
						<X size={13} />
					</button>
				)}
			</div>

			{open && (
				<div
					className="absolute left-0 right-0 z-50 bg-ink-900 border border-[var(--stroke-strong)] rounded-md shadow-[var(--shadow-lg)] overflow-hidden"
					// dynamic: top offset depends on trigger height
					style={{ top: h + 6 }}
				>
					{/* search */}
					<div className="p-2 border-b border-[var(--stroke-default)]">
						<div className="relative flex items-center">
							<Search
								size={13}
								className="absolute left-[9px] text-paper-300 shrink-0 pointer-events-none"
							/>
							<Input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="Search champions"
								autoFocus
								className="h-[30px] pl-[28px] text-[12px]"
							/>
						</div>
					</div>

					{/* list */}
					<div className="max-h-[232px] overflow-y-auto p-1">
						{list.length === 0 && (
							<p className="py-[14px] text-center text-[12px] text-paper-400">No champions match</p>
						)}
						{list.map((c) => (
							<button
								key={c.key}
								type="button"
								onClick={() => {
									onChange(c.key)
									setOpen(false)
									setQ("")
								}}
								className={cn(
									"flex items-center gap-[9px] w-full px-2 py-[6px]",
									"border-none cursor-pointer rounded-sm text-left text-paper-100",
									"transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)]",
									value === c.key ? "bg-[var(--accent-bg)]" : "bg-transparent hover:bg-ink-800",
								)}
							>
								<ChampionPortrait champion={c} version={version} size={26} />
								<span
									className={cn(
										"flex-1 text-[13px] font-medium leading-[1.2]",
										value === c.key ? "text-accent" : "text-paper-100",
									)}
								>
									{c.name}
								</span>
								{/* champion title instead of role abbr (ChampionStatic has no role field) */}
								<span className="font-mono text-[9px] font-semibold tracking-[0.08em] text-paper-400">
									{c.title}
								</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
