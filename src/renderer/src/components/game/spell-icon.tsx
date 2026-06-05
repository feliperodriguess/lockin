import { spellIconUrl } from "@renderer/lib/ddragon-urls"
import { useEffect, useState } from "react"

import type { SummonerSpellStatic } from "@/shared/types"

interface SpellIconProps {
	spell: SummonerSpellStatic | null
	version: string
	size?: number
	keyHint?: "D" | "F"
}

export function SpellIcon({
	spell,
	version,
	size = 28,
	keyHint,
}: SpellIconProps): React.JSX.Element | null {
	const [err, setErr] = useState(false)

	// reset the fallback when the spell identity changes
	useEffect(() => {
		setErr(false)
	}, [spell?.key])

	if (!spell) return null

	return (
		<div
			title={spell.name}
			style={{
				width: size,
				height: size,
				borderRadius: "var(--radius-xs)",
				position: "relative",
				overflow: "hidden",
				background: "var(--color-ink-800)",
				border: "1px solid var(--stroke-default)",
				flexShrink: 0,
			}}
		>
			{!err ? (
				<img
					src={spellIconUrl(version, spell.imageFull)}
					alt={spell.name}
					onError={() => setErr(true)}
					style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
				/>
			) : (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "grid",
						placeItems: "center",
						font: "600 9px/1 var(--font-mono)",
						color: "var(--fg-2)",
					}}
				>
					{spell.name.slice(0, 4)}
				</div>
			)}
			{keyHint && (
				<span
					style={{
						position: "absolute",
						bottom: -1,
						right: -1,
						padding: "1px 3px",
						background: "var(--color-ink-950)",
						borderTopLeftRadius: 4,
						font: "600 8px/1 var(--font-mono)",
						color: "var(--color-accent)",
					}}
				>
					{keyHint}
				</span>
			)}
		</div>
	)
}
