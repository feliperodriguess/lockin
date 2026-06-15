import type { ChampSelectPlayer, ChampSelectSession, Role } from "@/shared/types"

/** DDragon champion id → the lane the champion most commonly plays.
 *  Moved from src/renderer/src/lib/roles.ts (values converted DisplayRole → Role)
 *  so the main process can match lane opponents for the in-game carry-over. */
export const CHAMPION_LANE: Record<string, Role> = {
	Aatrox: "top",
	Ahri: "middle",
	Akali: "middle",
	Akshan: "middle",
	Alistar: "utility",
	Ambessa: "top",
	Amumu: "jungle",
	Anivia: "middle",
	Annie: "middle",
	Aphelios: "bottom",
	Ashe: "bottom",
	AurelionSol: "middle",
	Aurora: "middle",
	Azir: "middle",
	Bard: "utility",
	Belveth: "jungle",
	Blitzcrank: "utility",
	Brand: "utility",
	Braum: "utility",
	Briar: "jungle",
	Caitlyn: "bottom",
	Camille: "top",
	Cassiopeia: "middle",
	Chogath: "top",
	Corki: "middle",
	Darius: "top",
	Diana: "jungle",
	DrMundo: "top",
	Draven: "bottom",
	Ekko: "middle",
	Elise: "jungle",
	Evelynn: "jungle",
	Ezreal: "bottom",
	Fiddlesticks: "jungle",
	Fiora: "top",
	Fizz: "middle",
	Galio: "middle",
	Gangplank: "top",
	Garen: "top",
	Gnar: "top",
	Gragas: "jungle",
	Graves: "jungle",
	Gwen: "top",
	Hecarim: "jungle",
	Heimerdinger: "middle",
	Hwei: "middle",
	Illaoi: "top",
	Irelia: "top",
	Ivern: "jungle",
	Janna: "utility",
	JarvanIV: "jungle",
	Jax: "top",
	Jayce: "top",
	Jhin: "bottom",
	Jinx: "bottom",
	Kaisa: "bottom",
	Kalista: "bottom",
	Karma: "utility",
	Karthus: "jungle",
	Kassadin: "middle",
	Katarina: "middle",
	Kayle: "top",
	Kayn: "jungle",
	Kennen: "top",
	Khazix: "jungle",
	Kindred: "jungle",
	Kled: "top",
	KogMaw: "bottom",
	KSante: "top",
	Leblanc: "middle",
	LeeSin: "jungle",
	Leona: "utility",
	Lillia: "jungle",
	Lissandra: "middle",
	Lucian: "bottom",
	Lulu: "utility",
	Lux: "utility",
	Malphite: "top",
	Malzahar: "middle",
	Maokai: "utility",
	MasterYi: "jungle",
	Mel: "middle",
	Milio: "utility",
	MissFortune: "bottom",
	MonkeyKing: "jungle",
	Mordekaiser: "top",
	Morgana: "utility",
	Naafiri: "middle",
	Nami: "utility",
	Nasus: "top",
	Nautilus: "utility",
	Neeko: "middle",
	Nidalee: "jungle",
	Nilah: "bottom",
	Nocturne: "jungle",
	Nunu: "jungle",
	Olaf: "jungle",
	Orianna: "middle",
	Ornn: "top",
	Pantheon: "top",
	Poppy: "jungle",
	Pyke: "utility",
	Qiyana: "middle",
	Quinn: "top",
	Rakan: "utility",
	Rammus: "jungle",
	RekSai: "jungle",
	Rell: "utility",
	Renata: "utility",
	Renekton: "top",
	Rengar: "jungle",
	Riven: "top",
	Rumble: "top",
	Ryze: "middle",
	Samira: "bottom",
	Sejuani: "jungle",
	Senna: "utility",
	Seraphine: "utility",
	Sett: "top",
	Shaco: "jungle",
	Shen: "top",
	Shyvana: "jungle",
	Singed: "top",
	Sion: "top",
	Sivir: "bottom",
	Skarner: "jungle",
	Smolder: "bottom",
	Sona: "utility",
	Soraka: "utility",
	Swain: "utility",
	Sylas: "middle",
	Syndra: "middle",
	TahmKench: "utility",
	Taliyah: "jungle",
	Talon: "middle",
	Taric: "utility",
	Teemo: "top",
	Thresh: "utility",
	Tristana: "bottom",
	Trundle: "jungle",
	Tryndamere: "top",
	TwistedFate: "middle",
	Twitch: "bottom",
	Udyr: "jungle",
	Urgot: "top",
	Varus: "bottom",
	Vayne: "bottom",
	Veigar: "middle",
	Velkoz: "utility",
	Vex: "middle",
	Vi: "jungle",
	Viego: "jungle",
	Viktor: "middle",
	Vladimir: "middle",
	Volibear: "jungle",
	Warwick: "jungle",
	Xayah: "bottom",
	Xerath: "utility",
	XinZhao: "jungle",
	Yasuo: "middle",
	Yone: "middle",
	Yorick: "top",
	Yuumi: "utility",
	Zac: "jungle",
	Zed: "middle",
	Zeri: "bottom",
	Ziggs: "middle",
	Zilean: "utility",
	Zoe: "middle",
	Zyra: "utility",
}

export function championLaneRole(id: string): Role | null {
	return CHAMPION_LANE[id] ?? null
}

const ROLES: readonly Role[] = ["top", "jungle", "middle", "bottom", "utility"]

/** LCU assignedPosition → Role; "" or anything unrecognized → null. */
export function asRole(position: string): Role | null {
	return (ROLES as readonly string[]).includes(position) ? (position as Role) : null
}

export interface LaneMatchup {
	/** my LCU assignedPosition ("" when unassigned) */
	assignedPosition: string
	/** visible enemy in my lane, or null when no confident match */
	opponentChampionId: number | null
}

/** Matchup target = the enemy in MY lane. Riot doesn't expose enemy
 *  assignedPosition in champ select, so prefer it when present and otherwise
 *  infer the enemy's lane from the champion. No confident match (role pending,
 *  or no enemy maps to my lane) → null rather than guessing the wrong enemy. */
export function findLaneOpponent(
	session: ChampSelectSession,
	championIdOf: (championKey: number) => string | null,
): LaneMatchup {
	const me = session.myTeam.find((p) => p.cellId === session.localPlayerCellId)
	const assignedPosition = me?.assignedPosition ?? ""
	const myRole = asRole(assignedPosition)
	if (!myRole) return { assignedPosition, opponentChampionId: null }
	const opponent = session.theirTeam.find((p) => {
		if (p.championId <= 0) return false
		const role = asRole(p.assignedPosition) ?? championLaneRole(championIdOf(p.championId) ?? "")
		return role === myRole
	})
	return { assignedPosition, opponentChampionId: opponent?.championId ?? null }
}

/** Lane matchup from the assembled in-game rosters. Unlike champ select, the
 *  in-game payload exposes every player's champion (and usually position), so this
 *  works even when the app never observed champ select: it identifies the local
 *  player by puuid (then by champion), infers my role from my assigned position or
 *  my champion's default lane, and returns the enemy sharing that lane. Use this as
 *  the live, more-complete source once in-game; pair it with findLaneOpponent's
 *  champ-select carry-over as a fallback. */
export function findInGameLaneOpponent(
	myTeam: ChampSelectPlayer[],
	theirTeam: ChampSelectPlayer[],
	localPuuid: string,
	localChampionId: number,
	championIdOf: (championKey: number) => string | null,
): LaneMatchup {
	const me =
		(localPuuid ? myTeam.find((p) => p.puuid === localPuuid) : undefined) ??
		(localChampionId ? myTeam.find((p) => p.championId === localChampionId) : undefined)
	const assignedPosition = me?.assignedPosition ?? ""
	const myRole = asRole(assignedPosition) ?? championLaneRole(championIdOf(localChampionId) ?? "")
	if (!myRole) return { assignedPosition, opponentChampionId: null }
	const opponent = theirTeam.find((p) => {
		if (p.championId <= 0) return false
		const role = asRole(p.assignedPosition) ?? championLaneRole(championIdOf(p.championId) ?? "")
		return role === myRole
	})
	return { assignedPosition, opponentChampionId: opponent?.championId ?? null }
}
