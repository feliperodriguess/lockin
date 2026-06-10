import { Card } from "@renderer/components/app/card"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { Section } from "@renderer/components/champ-select/section"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { ItemStrip } from "@renderer/components/game/item-strip"
import { RoleTag } from "@renderer/components/game/role"
import { RunesReference } from "@renderer/components/game/runes-reference"
import { SkillOrderGrid } from "@renderer/components/game/skill-order-grid"
import { SpellPair } from "@renderer/components/game/spell-pair"
import { NoteCard } from "@renderer/components/notes/note-card"
import { Button } from "@renderer/components/ui/button"
import {
	useBuildRecommendation,
	useDDragon,
	useNotes,
	useSettings,
	useUpsertNote,
} from "@renderer/hooks/use-data"
import { useInGame } from "@renderer/hooks/use-lcu"
import { winSampleLabel } from "@renderer/lib/build-format"
import { championLane, displayToRole, roleToDisplay } from "@renderer/lib/roles"
import { useNavigate } from "@tanstack/react-router"
import { Plus, Swords } from "lucide-react"

import { matchupNote } from "@/shared/lib/notes-match"
import type { Role, SummonerSpellStatic } from "@/shared/types"

export function InGameScreen(): React.JSX.Element | null {
	const inGame = useInGame()
	const { data: bundle } = useDDragon()
	const { data: settings } = useSettings()
	const { data: notes } = useNotes()
	const upsert = useUpsertNote()
	const navigate = useNavigate()

	const version = bundle?.version ?? ""
	const layout = settings?.spellSlotLayout ?? "DF"

	const champion = inGame && bundle ? (bundle.championsByKey[inGame.championId] ?? null) : null
	const displayRole = champion ? championLane(champion.id) : null
	const role: Role | null = displayRole ? displayToRole(displayRole) : null

	const { data: build } = useBuildRecommendation(
		inGame?.championId ?? null,
		role,
		settings?.buildTier,
	)

	if (!inGame || !bundle) return null

	const s0: SummonerSpellStatic | null = bundle.spellsByKey[inGame.spell1Id] ?? null
	const s1: SummonerSpellStatic | null = bundle.spellsByKey[inGame.spell2Id] ?? null
	const spellPair = s0 && s1 ? ([s0, s1] as [SummonerSpellStatic, SummonerSpellStatic]) : null

	const note = matchupNote(notes ?? [], inGame.championId, null)

	return (
		<section className="grid h-full min-h-0 gap-[14px] grid-cols-[1fr_314px] grid-rows-[minmax(0,1fr)]">
			<div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto -mr-1 pr-1">
				{/* header strip */}
				<Card className="flex min-h-[78px] items-center justify-between gap-3 p-4">
					<div className="flex min-w-0 items-center gap-3">
						<ChampionPortrait champion={champion} version={version} size={46} ring radius={10} />
						<div className="flex min-w-0 flex-col gap-[6px]">
							<span className="text-[16px] font-semibold leading-none tracking-[-0.01em] text-paper-100">
								{champion?.name ?? "In game"}
							</span>
							{role && <RoleTag role={roleToDisplay(role)} active />}
						</div>
						<span className="h-10 w-px shrink-0 bg-(--stroke-default)" />
						<SpellPair pair={spellPair} version={version} layout={layout} size={32} showKeys />
					</div>
					<span className="inline-flex items-center gap-[6px] rounded-sm bg-(--accent-bg) px-2 py-[5px] font-mono text-[10px] font-semibold uppercase leading-none tracking-widest text-accent">
						<Swords size={11} />
						In game
					</span>
				</Card>

				{/* matchup note */}
				<Section label="Your note">
					{note ? (
						<NoteCard
							key={note.id}
							note={note}
							bundle={bundle}
							version={version}
							variant="compact"
							onSaveBody={(body) => {
								if (!upsert.isPending) upsert.mutate({ id: note.id, body })
							}}
							saving={upsert.isPending}
						/>
					) : (
						<div className="flex flex-1 flex-col justify-center gap-3">
							<ChampionPortrait champion={champion} version={version} size={24} />
							<p className="m-0 text-[14px] leading-normal text-paper-200">
								No note yet for <b className="font-semibold text-paper-100">{champion?.name}</b>.
							</p>
							<Button
								className="self-start"
								onClick={() => navigate({ to: "/notes", search: { new: true } })}
							>
								<Plus size={16} />
								Add a note
							</Button>
						</div>
					)}
				</Section>

				{/* recommended build */}
				{build && (
					<Section
						label="Build"
						right={
							<span className="font-mono text-[10px] leading-none text-paper-400">
								{winSampleLabel(build.winRate, build.sampleSize)}
							</span>
						}
					>
						<div className="flex flex-col gap-[14px] py-1">
							<ItemStrip items={build.items} bundle={bundle} version={version} />
							{build.skillOrder.length > 0 && (
								<div className="border-t border-(--stroke-subtle) pt-[14px]">
									<SkillOrderGrid
										skillOrder={build.skillOrder}
										skillPriority={build.skillPriority}
									/>
								</div>
							)}
						</div>
					</Section>
				)}
			</div>

			{/* right rail */}
			<div className="flex min-h-0 flex-col gap-[14px]">
				<Section label="You" grow>
					<div className="flex flex-1 flex-col gap-3">
						<div className="flex items-center gap-[10px]">
							<ChampionPortrait champion={champion} version={version} size={36} ring />
							<div className="flex min-w-0 flex-col gap-[3px]">
								<span className="text-[13px] font-semibold leading-none text-paper-100">
									{champion?.name}
								</span>
								{role && (
									<span className="font-mono text-[10px] leading-none text-paper-400">
										{roleToDisplay(role)}
									</span>
								)}
							</div>
						</div>
						{build?.runes ? (
							<div className="border-t border-(--stroke-subtle) pt-3">
								<Eyebrow line={18}>Runes</Eyebrow>
								<div className="pt-3">
									<RunesReference runes={build.runes} bundle={bundle} />
								</div>
							</div>
						) : null}
					</div>
				</Section>
			</div>
		</section>
	)
}
