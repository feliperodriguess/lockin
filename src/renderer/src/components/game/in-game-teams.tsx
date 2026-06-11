import { Section } from "@renderer/components/champ-select/section"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { RankBadge } from "@renderer/components/game/rank-badge"
import { RoleGlyph } from "@renderer/components/game/role"
import { useTeamRanks } from "@renderer/hooks/use-data"
import { useSummoner } from "@renderer/hooks/use-lcu"
import { MAIN_ROLE_ORDER } from "@renderer/lib/mains"
import { roleToDisplay } from "@renderer/lib/roles"
import { cn } from "@renderer/lib/utils"
import { Swords } from "lucide-react"

import { asRole } from "@/shared/lib/lanes"
import type { ChampSelectPlayer, DDragonBundle, InGameState, RankInfo } from "@/shared/types"

/** Top → Jungle → Mid → Bot → Support; unknown positions sink to the bottom. */
function byRole(players: ChampSelectPlayer[]): ChampSelectPlayer[] {
	const index = (p: ChampSelectPlayer): number => {
		const role = asRole(p.assignedPosition)
		return role ? MAIN_ROLE_ORDER.indexOf(role) : MAIN_ROLE_ORDER.length
	}
	return [...players].sort((a, b) => index(a) - index(b))
}

interface InGameTeamsProps {
	inGame: InGameState
	bundle: DDragonBundle
	version: string
}

export function InGameTeams({ inGame, bundle, version }: InGameTeamsProps): React.JSX.Element {
	const summoner = useSummoner()
	// in-game the LCU exposes every player's puuid, so both rosters get ranks
	const puuids = [...inGame.myTeam, ...inGame.theirTeam].map((p) => p.puuid).filter(Boolean)
	const { data: ranks } = useTeamRanks(puuids)

	if (inGame.myTeam.length === 0 && inGame.theirTeam.length === 0) {
		return (
			<Section label="Teams" grow>
				<div className="flex flex-1 items-center justify-center px-4 text-center">
					<p className="m-0 text-[12.5px] leading-normal text-paper-400">
						Rosters unavailable — lockin didn't see this game's champ select.
					</p>
				</div>
			</Section>
		)
	}

	return (
		<>
			<Section label="Your team" grow scroll>
				<ul className="m-0 flex flex-1 flex-col gap-px p-0">
					{byRole(inGame.myTeam).map((p) => (
						<PlayerRow
							key={p.cellId}
							player={p}
							bundle={bundle}
							version={version}
							you={summoner != null && p.puuid === summoner.puuid}
							rank={ranks?.[p.puuid] ?? null}
						/>
					))}
				</ul>
			</Section>
			<Section label="Enemy team" grow scroll>
				<ul className="m-0 flex flex-1 flex-col gap-px p-0">
					{byRole(inGame.theirTeam).map((p) => (
						<PlayerRow
							key={p.cellId}
							player={p}
							bundle={bundle}
							version={version}
							yourLane={p.championId !== 0 && p.championId === inGame.opponentChampionId}
							rank={ranks?.[p.puuid] ?? null}
						/>
					))}
				</ul>
			</Section>
		</>
	)
}

function PlayerRow({
	player,
	bundle,
	version,
	you,
	yourLane,
	rank,
}: {
	player: ChampSelectPlayer
	bundle: DDragonBundle
	version: string
	you?: boolean
	yourLane?: boolean
	rank?: RankInfo | null
}): React.JSX.Element {
	const champion = bundle.championsByKey[player.championId] ?? null
	const role = asRole(player.assignedPosition)
	const name = player.gameName ?? champion?.name ?? "Unknown"
	return (
		<li className="flex items-center gap-[10px] px-1 py-[6px]">
			<RoleGlyph role={role ? roleToDisplay(role) : null} size={15} color="var(--fg-4)" />
			<ChampionPortrait champion={champion} version={version} size={30} ring={you || yourLane} />
			<div className="flex min-w-0 flex-1 flex-col gap-[2px]">
				<span
					className={cn(
						"overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold leading-none",
						you || yourLane ? "text-accent" : "text-paper-100",
					)}
				>
					{name}
					{you ? " (you)" : ""}
				</span>
				{player.gameName && (
					<span className="font-mono text-[10px] leading-none text-paper-400">
						{champion?.name}
					</span>
				)}
			</div>
			{yourLane && (
				<span
					title="Your lane opponent"
					className="inline-flex items-center gap-1 rounded-sm bg-(--accent-bg) px-[6px] py-[3px] font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-accent"
				>
					<Swords size={10} />
					Lane
				</span>
			)}
			{rank != null && <RankBadge rank={rank} size="sm" />}
		</li>
	)
}
