import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { Input } from "@renderer/components/ui/input"
import { championLane, ROLE_ABBR } from "@renderer/lib/roles"
import { cn } from "@renderer/lib/utils"
import { ChevronDown, Search, X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import type { DDragonBundle } from "@/shared/types"

const DROPDOWN_MAX_H = 232 // list max height when there is ample room
const DROPDOWN_MIN_H = 96 // never shrink the list below this; it scrolls instead
const DROPDOWN_GAP = 6 // offset between trigger and panel
const DROPDOWN_HEADER_H = 47 // search block above the list (p-2 + 30px input)
const VIEWPORT_MARGIN = 12 // breathing room from the bounding edge

// Walks up to the nearest scrollable ancestor and returns its viewport rect, so the
// dropdown can be bounded by it (the note-editor drawer scrolls, and its footer marks
// the bottom of that scroll area). Falls back to the full viewport.
function scrollableAncestorRect(el: HTMLElement): { top: number; bottom: number } {
	let node = el.parentElement
	while (node) {
		// Match on the overflow style itself (not live overflow) so a scroll region that
		// isn't currently overflowing — e.g. the drawer form above its footer — still bounds us.
		if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) {
			const r = node.getBoundingClientRect()
			return { top: r.top, bottom: r.bottom }
		}
		node = node.parentElement
	}
	return { top: 0, bottom: window.innerHeight }
}

interface ChampionPickerProps {
	value: number | null
	onChange: (id: number | null) => void
	bundle: DDragonBundle
	version: string
	placeholder?: string
	allowClear?: boolean
	size?: "sm" | "md"
	excludeIds?: number[]
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
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
	defaultOpen = false,
	onOpenChange,
}: ChampionPickerProps): React.JSX.Element {
	const [open, setOpenState] = useState(defaultOpen)
	const setOpen = (v: boolean) => {
		setOpenState(v)
		onOpenChange?.(v)
	}
	const [q, setQ] = useState("")
	const ref = useRef<HTMLDivElement>(null)
	// Viewport-aware placement so the dropdown never clips at small window heights
	// (e.g. inside the note-editor drawer at the 500px min height): open upward when
	// there is more room above, and cap the panel height to the space available.
	const [placement, setPlacement] = useState<{ dir: "down" | "up"; maxH: number }>({
		dir: "down",
		maxH: DROPDOWN_MAX_H,
	})

	// click-outside close
	useEffect(() => {
		if (!open) return
		const h = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", h)
		return () => document.removeEventListener("mousedown", h)
	})

	// Measure available space around the trigger whenever the dropdown opens, and on
	// resize/scroll while open, to choose direction + a non-clipping max height. Bounds
	// come from the nearest scrollable ancestor (e.g. the note-editor drawer's form, whose
	// bottom is the footer) clamped to the viewport — so the panel never hides under a
	// sticky footer or runs off-screen at the 500px min window height.
	useLayoutEffect(() => {
		if (!open) return
		const recompute = () => {
			const el = ref.current
			if (!el) return
			const rect = el.getBoundingClientRect()
			const bounds = scrollableAncestorRect(el)
			const topBound = Math.max(bounds.top, 0) + VIEWPORT_MARGIN
			const bottomBound = Math.min(bounds.bottom, window.innerHeight) - VIEWPORT_MARGIN
			// room for the *list* = panel space minus the search header above it
			const below = bottomBound - rect.bottom - DROPDOWN_GAP - DROPDOWN_HEADER_H
			const above = rect.top - topBound - DROPDOWN_GAP - DROPDOWN_HEADER_H
			const openUp = below < DROPDOWN_MIN_H && above > below
			const room = openUp ? above : below
			setPlacement({
				dir: openUp ? "up" : "down",
				maxH: Math.max(DROPDOWN_MIN_H, Math.min(DROPDOWN_MAX_H, Math.floor(room))),
			})
		}
		recompute()
		window.addEventListener("resize", recompute)
		window.addEventListener("scroll", recompute, true)
		return () => {
			window.removeEventListener("resize", recompute)
			window.removeEventListener("scroll", recompute, true)
		}
	}, [open])

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
			<div className="relative">
				<button
					type="button"
					onClick={() => setOpen(!open)}
					className={cn(
						"flex items-center gap-[9px] w-full text-left cursor-pointer",
						"bg-ink-950 border rounded-sm",
						"transition-[border-color,box-shadow] duration-160 ease-(--ease-standard)",
						"text-paper-100",
						open
							? "border-accent shadow-[0_0_0_1px_var(--color-accent),0_0_16px_var(--accent-glow)]"
							: "border-(--stroke-default)",
					)}
					style={{ height: h, padding: allowClear && sel ? "0 28px 0 8px" : "0 10px 0 8px" }}
				>
					{sel ? (
						<ChampionPortrait champion={sel} version={version} size={portraitSize} />
					) : (
						<span
							className="shrink-0 block rounded-xs border border-dashed border-(--stroke-strong)"
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

				{allowClear && sel && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							onChange(null)
						}}
						className="absolute right-7 top-1/2 -translate-y-1/2 flex text-paper-400 p-0.5 cursor-pointer bg-none border-none z-1"
					>
						<X size={13} />
					</button>
				)}
			</div>

			{open && (
				<div
					className="absolute left-0 right-0 z-50 bg-ink-900 border border-(--stroke-strong) rounded-md shadow-(--shadow-lg) overflow-hidden"
					// dynamic: anchor below the trigger, or above it when space is tight
					style={placement.dir === "up" ? { bottom: h + DROPDOWN_GAP } : { top: h + DROPDOWN_GAP }}
				>
					{/* search */}
					<div className="p-2 border-b border-(--stroke-default)">
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
					<div className="overflow-y-auto p-1" style={{ maxHeight: placement.maxH }}>
						{list.length === 0 && (
							<p className="py-[14px] text-center text-[12px] text-paper-400">No champions match</p>
						)}
						{list.map((c) => {
							const lane = championLane(c.id)
							return (
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
										"transition-colors duration-(--dur-base) ease-(--ease-standard)",
										value === c.key ? "bg-(--accent-bg)" : "bg-transparent hover:bg-ink-800",
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
									{lane && (
										<span className="font-mono text-[9px] font-semibold tracking-[0.08em] text-paper-400">
											{ROLE_ABBR[lane]}
										</span>
									)}
								</button>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}
