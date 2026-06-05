// components.jsx:8-253 — NoteTitle + NoteCard (full/compact variants).
// bundle/version passed as props — no internal useDDragon (anti-pattern).

import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { SpellPair } from "@renderer/components/game/spell-pair"
import { Textarea } from "@renderer/components/ui/textarea"
import { timeAgo } from "@renderer/lib/time"
import { cn } from "@renderer/lib/utils"
import { Check, SquarePen } from "lucide-react"
import { useState } from "react"

import type { DDragonBundle, MatchupNote, SummonerSpellStatic } from "@/shared/types"

interface NoteTitleProps {
	note: MatchupNote
	bundle: DDragonBundle
	version: string
	size?: number
}

export function NoteTitle({ note, bundle, version, size = 22 }: NoteTitleProps): React.JSX.Element {
	const champ = note.championId ? (bundle.championsByKey[note.championId] ?? null) : null
	const opp = note.opponentChampionId
		? (bundle.championsByKey[note.opponentChampionId] ?? null)
		: null
	return (
		<div className="flex min-w-0 items-center gap-2">
			<ChampionPortrait champion={champ} version={version} size={size} />
			<span className="shrink-0 whitespace-nowrap text-[14px] font-semibold leading-none text-paper-100">
				{champ?.name}
			</span>
			{opp && (
				<>
					<span className="shrink-0 font-mono text-[11px] leading-none text-paper-400">vs</span>
					<ChampionPortrait champion={opp} version={version} size={size} />
					<span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-medium leading-none text-paper-200">
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
			className={cn(
				"flex h-full w-full cursor-pointer flex-col gap-[11px] overflow-hidden rounded-md p-4 text-left",
				"border border-[var(--stroke-default)]",
				"transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)]",
				hover ? "bg-ink-800" : "bg-ink-850",
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<NoteTitle note={note} bundle={bundle} version={version} size={26} />
				</div>
				<SquarePen
					size={14}
					className={cn(
						"mt-[2px] shrink-0 transition-colors duration-[160ms]",
						hover ? "text-paper-200" : "text-paper-400",
					)}
				/>
			</div>
			<p className="m-0 flex-1 line-clamp-3 text-[13px] leading-[1.55] text-paper-200 [text-wrap:pretty]">
				{note.body}
			</p>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
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
				<time
					dateTime={note.updatedAt}
					className="whitespace-nowrap font-mono text-[10.5px] leading-none text-paper-400"
				>
					{timeAgo(note.updatedAt)}
				</time>
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
			className="flex h-full flex-col gap-[10px]"
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
		>
			<div className="flex items-center justify-between gap-2">
				<NoteTitle note={note} bundle={bundle} version={version} size={24} />
				<button
					type="button"
					onClick={toggle}
					disabled={saving}
					title="Edit note"
					className={cn(
						"inline-flex items-center gap-[5px]",
						"rounded-sm px-2 py-1",
						"border text-[11px] font-medium leading-none",
						"transition-all duration-[var(--dur-base)] ease-[var(--ease-standard)]",
						editing
							? "border-transparent bg-[var(--accent-bg)] text-accent"
							: hover
								? "border-[var(--stroke-default)] bg-transparent text-paper-300"
								: "border-transparent bg-transparent text-paper-300",
						saving && "cursor-not-allowed opacity-50",
					)}
				>
					{editing ? <Check size={12} /> : <SquarePen size={12} />}
					{editing ? "Done" : "Edit"}
				</button>
			</div>
			{editing ? (
				<Textarea
					rows={5}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					autoFocus
					className="min-h-0 flex-1 resize-none text-[14px] leading-[1.6] text-paper-100"
				/>
			) : (
				<p className="m-0 min-h-0 flex-1 overflow-y-auto text-[14.5px] leading-[1.62] tracking-[0.005em] [text-wrap:pretty] whitespace-pre-wrap text-paper-100">
					{note.body}
				</p>
			)}
		</div>
	)
}
