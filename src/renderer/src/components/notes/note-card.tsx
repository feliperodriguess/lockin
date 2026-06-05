// components.jsx:8-253 — NoteTitle + NoteCard (full/compact variants).
// bundle/version passed as props — no internal useDDragon (anti-pattern).

import { TextInput } from "@renderer/components/app/text-input"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { SpellPair } from "@renderer/components/game/spell-pair"
import { timeAgo } from "@renderer/lib/time"
import { Check, SquarePen } from "lucide-react"
import { useState } from "react"

import type { DDragonBundle, MatchupNote, SummonerSpellStatic } from "@/shared/types"

interface NoteTitleProps {
	note: MatchupNote
	bundle: DDragonBundle
	version: string
	size?: number
	fs?: number
}

export function NoteTitle({
	note,
	bundle,
	version,
	size = 22,
	fs = 14,
}: NoteTitleProps): React.JSX.Element {
	const champ = note.championId ? (bundle.championsByKey[note.championId] ?? null) : null
	const opp = note.opponentChampionId
		? (bundle.championsByKey[note.opponentChampionId] ?? null)
		: null
	return (
		<div className="flex min-w-0 items-center" style={{ gap: 8 }}>
			<ChampionPortrait champion={champ} version={version} size={size} />
			<span
				className="shrink-0 whitespace-nowrap"
				style={{ font: `600 ${fs}px/1 var(--font-ui)`, color: "var(--fg-1)" }}
			>
				{champ?.name}
			</span>
			{opp && (
				<>
					<span
						className="shrink-0"
						style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}
					>
						vs
					</span>
					<ChampionPortrait champion={opp} version={version} size={size} />
					<span
						className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
						style={{ font: `500 ${fs}px/1 var(--font-ui)`, color: "var(--fg-2)" }}
					>
						{opp.name}
					</span>
				</>
			)}
		</div>
	)
}

interface NoteCardFullProps {
	note: MatchupNote
	bundle: DDragonBundle
	version: string
	variant: "full"
	/** AppSettings.spellSlotLayout for rendering spell pair D/F labels */
	spellSlotLayout?: "DF" | "FD"
	onClick?: () => void
}

interface NoteCardCompactProps {
	note: MatchupNote
	bundle: DDragonBundle
	version: string
	variant: "compact"
	/** Called when user saves body in inline edit mode */
	onSaveBody?: (body: string) => void
	/** Whether a save is in flight; disables edit toggle while true */
	saving?: boolean
}

type NoteCardProps = NoteCardFullProps | NoteCardCompactProps

export function NoteCard(props: NoteCardProps): React.JSX.Element {
	const { note, bundle, version, variant } = props

	if (variant === "compact") {
		return (
			<CompactCard
				note={note}
				bundle={bundle}
				version={version}
				onSaveBody={(props as NoteCardCompactProps).onSaveBody}
				saving={(props as NoteCardCompactProps).saving}
			/>
		)
	}

	return (
		<FullCard
			note={note}
			bundle={bundle}
			version={version}
			spellSlotLayout={(props as NoteCardFullProps).spellSlotLayout ?? "DF"}
			onClick={(props as NoteCardFullProps).onClick}
		/>
	)
}

/* ---------- full (library) ---------- */

interface FullCardProps {
	note: MatchupNote
	bundle: DDragonBundle
	version: string
	spellSlotLayout: "DF" | "FD"
	onClick?: () => void
}

function FullCard({ note, bundle, version, spellSlotLayout, onClick }: FullCardProps) {
	const [hover, setHover] = useState(false)

	// Build spell pair from pinnedSpells
	let spellPair: [SummonerSpellStatic, SummonerSpellStatic] | null = null
	if (note.pinnedSpells && note.pinnedSpells.length === 2) {
		const s0 = bundle.spellsByKey[note.pinnedSpells[0]] ?? null
		const s1 = bundle.spellsByKey[note.pinnedSpells[1]] ?? null
		if (s0 && s1) spellPair = [s0, s1]
	}

	return (
		<button
			type="button"
			onClick={onClick}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				background: hover ? "var(--bg-hover)" : "var(--bg-raised)",
				border: "1px solid var(--stroke-default)",
				borderRadius: "var(--radius-md)",
				padding: 16,
				cursor: "pointer",
				display: "flex",
				flexDirection: "column",
				gap: 11,
				overflow: "hidden",
				transition: "background 160ms var(--ease-standard)",
				height: "100%",
				boxSizing: "border-box",
				width: "100%",
				textAlign: "left",
			}}
		>
			<div className="flex items-start justify-between" style={{ gap: 8 }}>
				<div className="min-w-0 flex-1">
					<NoteTitle note={note} bundle={bundle} version={version} size={26} fs={14} />
				</div>
				<SquarePen
					size={14}
					style={{
						color: hover ? "var(--fg-2)" : "var(--fg-4)",
						flexShrink: 0,
						marginTop: 2,
						transition: "color 160ms",
					}}
				/>
			</div>
			<p
				style={{
					margin: 0,
					font: "400 13px/1.55 var(--font-ui)",
					color: "var(--color-paper-200)",
					flex: 1,
					display: "-webkit-box",
					WebkitLineClamp: 3,
					WebkitBoxOrient: "vertical",
					overflow: "hidden",
					textWrap: "pretty",
				}}
			>
				{note.body}
			</p>
			<div className="flex items-center justify-between" style={{ gap: 8 }}>
				<div className="flex items-center" style={{ gap: 8 }}>
					{spellPair && (
						<SpellPair
							pair={spellPair}
							version={version}
							layout={spellSlotLayout}
							size={20}
							gap={3}
						/>
					)}
				</div>
				<span
					style={{
						font: "400 10.5px/1 var(--font-mono)",
						color: "var(--fg-4)",
						whiteSpace: "nowrap",
					}}
				>
					{timeAgo(note.updatedAt)}
				</span>
			</div>
		</button>
	)
}

/* ---------- compact (champ-select) ---------- */

interface CompactCardProps {
	note: MatchupNote
	bundle: DDragonBundle
	version: string
	onSaveBody?: (body: string) => void
	saving?: boolean
}

function CompactCard({ note, bundle, version, onSaveBody, saving = false }: CompactCardProps) {
	const [hover, setHover] = useState(false)
	const [editing, setEditing] = useState(false)
	// Seed draft from note.body; remounted via key={note.id} by parent so state resets per note
	const [draft, setDraft] = useState(note.body)

	const toggle = () => {
		if (saving) return
		if (editing && onSaveBody) {
			onSaveBody(draft)
		}
		setEditing((v) => !v)
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: mouse-enter/leave for hover-reveal only (no keyboard action needed)
		<div
			className="flex h-full flex-col"
			style={{ gap: 10 }}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
		>
			<div className="flex items-center justify-between" style={{ gap: 8 }}>
				<NoteTitle note={note} bundle={bundle} version={version} size={24} fs={14} />
				<button
					type="button"
					onClick={toggle}
					disabled={saving}
					title="Edit note"
					className="inline-flex items-center"
					style={{
						gap: 5,
						background: editing ? "var(--accent-bg)" : "transparent",
						border: "1px solid",
						borderColor: editing ? "transparent" : hover ? "var(--stroke-default)" : "transparent",
						color: editing ? "var(--color-accent)" : "var(--fg-3)",
						borderRadius: "var(--radius-sm)",
						padding: "4px 8px",
						cursor: saving ? "not-allowed" : "pointer",
						font: "500 11px/1 var(--font-ui)",
						transition: "all var(--dur-base) var(--ease-standard)",
						opacity: saving ? 0.5 : 1,
					}}
				>
					{editing ? <Check size={12} /> : <SquarePen size={12} />}
					{editing ? "Done" : "Edit"}
				</button>
			</div>
			{editing ? (
				<TextInput
					rows={5}
					value={draft}
					onChange={setDraft}
					autoFocus
					className="min-h-0 flex-1 resize-none text-[14px] leading-[1.6] text-[var(--fg-1)]"
				/>
			) : (
				<p
					className="min-h-0 flex-1 overflow-y-auto"
					style={{
						margin: 0,
						font: "400 14.5px/1.62 var(--font-ui)",
						color: "var(--color-paper-100)",
						letterSpacing: "0.005em",
						textWrap: "pretty",
						whiteSpace: "pre-wrap",
					}}
				>
					{note.body}
				</p>
			)}
		</div>
	)
}
