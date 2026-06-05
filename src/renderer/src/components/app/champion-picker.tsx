// components.jsx:256-451 — ChampionPicker combobox.
// Trigger button (portrait or dashed placeholder + name + optional clear X + ChevronDown),
// dropdown (search input + scrollable list with portraits + champion title 9px mono fg-4),
// click-outside close, "No champions match".

import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
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
		<div ref={ref} style={{ position: "relative" }}>
			{/* Wrapper so the clear X button can sit alongside the trigger without nesting */}
			<div style={{ position: "relative" }}>
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 9,
						width: "100%",
						height: h,
						// Add right padding room for the clear X when shown
						padding: allowClear && sel ? `0 28px 0 8px` : "0 10px 0 8px",
						boxSizing: "border-box",
						background: "var(--color-ink-950)",
						border: `1px solid ${open ? "var(--color-accent)" : "var(--stroke-default)"}`,
						boxShadow: open ? "0 0 0 1px var(--color-accent), 0 0 16px var(--accent-glow)" : "none",
						borderRadius: "var(--radius-sm)",
						cursor: "pointer",
						color: "var(--fg-1)",
						textAlign: "left",
						transition:
							"border-color 160ms var(--ease-standard), box-shadow 160ms var(--ease-standard)",
					}}
				>
					{sel ? (
						<ChampionPortrait champion={sel} version={version} size={portraitSize} />
					) : (
						<span
							style={{
								width: portraitSize,
								height: portraitSize,
								borderRadius: "var(--radius-xs)",
								border: "1px dashed var(--stroke-strong)",
								flexShrink: 0,
								display: "block",
							}}
						/>
					)}
					<span
						style={{
							flex: 1,
							font: "500 13px/1 var(--font-ui)",
							color: sel ? "var(--fg-1)" : "var(--fg-4)",
						}}
					>
						{sel ? sel.name : placeholder}
					</span>
					<ChevronDown size={14} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
				</button>
				{/* Clear X — sibling of trigger, absolutely positioned to avoid nested button */}
				{allowClear && sel && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							onChange(null)
						}}
						style={{
							position: "absolute",
							right: 28,
							top: "50%",
							transform: "translateY(-50%)",
							display: "flex",
							color: "var(--fg-4)",
							padding: 2,
							cursor: "pointer",
							background: "none",
							border: "none",
							zIndex: 1,
						}}
					>
						<X size={13} />
					</button>
				)}
			</div>

			{open && (
				<div
					style={{
						position: "absolute",
						top: h + 6,
						left: 0,
						right: 0,
						zIndex: 50,
						background: "var(--color-ink-900)",
						border: "1px solid var(--stroke-strong)",
						borderRadius: "var(--radius-md)",
						boxShadow: "var(--shadow-lg)",
						overflow: "hidden",
					}}
				>
					{/* search */}
					<div
						style={{
							padding: 8,
							borderBottom: "1px solid var(--stroke-default)",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 7,
								height: 30,
								padding: "0 9px",
								background: "var(--color-ink-950)",
								borderRadius: "var(--radius-sm)",
								border: "1px solid var(--stroke-default)",
							}}
						>
							<Search size={13} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
							<input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="Search champions"
								// biome-ignore lint/a11y/noAutofocus: intentional focus on dropdown open
								autoFocus
								style={{
									flex: 1,
									background: "none",
									border: "none",
									outline: "none",
									color: "var(--fg-1)",
									font: "400 12px/1 var(--font-ui)",
								}}
							/>
						</div>
					</div>

					{/* list */}
					<div style={{ maxHeight: 232, overflowY: "auto", padding: 4 }}>
						{list.length === 0 && (
							<div
								style={{
									padding: "14px",
									textAlign: "center",
									font: "400 12px/1 var(--font-ui)",
									color: "var(--fg-4)",
								}}
							>
								No champions match
							</div>
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
								style={{
									display: "flex",
									alignItems: "center",
									gap: 9,
									width: "100%",
									padding: "6px 8px",
									border: "none",
									cursor: "pointer",
									background: value === c.key ? "var(--accent-bg)" : "transparent",
									borderRadius: "var(--radius-sm)",
									textAlign: "left",
									color: "var(--fg-1)",
								}}
								onMouseEnter={(e) => {
									if (value !== c.key)
										(e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"
								}}
								onMouseLeave={(e) => {
									if (value !== c.key)
										(e.currentTarget as HTMLButtonElement).style.background = "transparent"
								}}
							>
								<ChampionPortrait champion={c} version={version} size={26} />
								<span
									style={{
										flex: 1,
										font: "500 13px/1.2 var(--font-ui)",
										color: value === c.key ? "var(--color-accent)" : "var(--fg-1)",
									}}
								>
									{c.name}
								</span>
								{/* champion title instead of role abbr (ChampionStatic has no role field) */}
								<span
									style={{
										font: "500 9px/1 var(--font-mono)",
										letterSpacing: "0.08em",
										color: "var(--fg-4)",
									}}
								>
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
