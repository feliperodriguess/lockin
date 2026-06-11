import type {
	AppSettings,
	BanListEntry,
	BuildRecommendation,
	ChampionAbilities,
	ChampionStatic,
	ChampSelectPlayer,
	CounterTable,
	DDragonBundle,
	InGameState,
	MatchupNote,
	RankInfo,
	SummonerIdentity,
	SummonerSpellStatic,
} from "@/shared/types"
import { DEFAULT_SETTINGS } from "@/shared/types"

/* data.js content RETYPED to PRD §7 shapes (spec §2) — real DDragon numeric keys. */

const CHAMPIONS: ChampionStatic[] = [
	{
		id: "Aatrox",
		key: 266,
		name: "Aatrox",
		title: "the Darkin Blade",
		tags: ["Fighter", "Tank"],
		imageFull: "Aatrox.png",
	},
	{
		id: "Fiora",
		key: 114,
		name: "Fiora",
		title: "the Grand Duelist",
		tags: ["Fighter", "Assassin"],
		imageFull: "Fiora.png",
	},
	{
		id: "Darius",
		key: 122,
		name: "Darius",
		title: "the Hand of Noxus",
		tags: ["Fighter", "Tank"],
		imageFull: "Darius.png",
	},
	{
		id: "Quinn",
		key: 133,
		name: "Quinn",
		title: "Demacia's Wings",
		tags: ["Marksman", "Assassin"],
		imageFull: "Quinn.png",
	},
	{
		id: "Camille",
		key: 164,
		name: "Camille",
		title: "the Steel Shadow",
		tags: ["Fighter", "Tank"],
		imageFull: "Camille.png",
	},
	{
		id: "Renekton",
		key: 58,
		name: "Renekton",
		title: "the Butcher",
		tags: ["Fighter", "Tank"],
		imageFull: "Renekton.png",
	},
	{
		id: "Sett",
		key: 875,
		name: "Sett",
		title: "the Boss",
		tags: ["Fighter", "Tank"],
		imageFull: "Sett.png",
	},
	{
		id: "Garen",
		key: 86,
		name: "Garen",
		title: "the Might of Demacia",
		tags: ["Fighter", "Tank"],
		imageFull: "Garen.png",
	},
	{
		id: "Ahri",
		key: 103,
		name: "Ahri",
		title: "the Nine-Tailed Fox",
		tags: ["Mage", "Assassin"],
		imageFull: "Ahri.png",
	},
	{
		id: "Yasuo",
		key: 157,
		name: "Yasuo",
		title: "the Unforgiven",
		tags: ["Fighter", "Assassin"],
		imageFull: "Yasuo.png",
	},
	{
		id: "LeeSin",
		key: 64,
		name: "Lee Sin",
		title: "the Blind Monk",
		tags: ["Fighter", "Assassin"],
		imageFull: "LeeSin.png",
	},
	{
		id: "Khazix",
		key: 121,
		name: "Kha'Zix",
		title: "the Voidreaver",
		tags: ["Assassin"],
		imageFull: "Khazix.png",
	},
	{
		id: "Jinx",
		key: 222,
		name: "Jinx",
		title: "the Loose Cannon",
		tags: ["Marksman"],
		imageFull: "Jinx.png",
	},
	{
		id: "Caitlyn",
		key: 51,
		name: "Caitlyn",
		title: "the Sheriff",
		tags: ["Marksman"],
		imageFull: "Caitlyn.png",
	},
	{
		id: "Thresh",
		key: 412,
		name: "Thresh",
		title: "the Chain Warden",
		tags: ["Support", "Fighter"],
		imageFull: "Thresh.png",
	},
	{
		id: "Lulu",
		key: 117,
		name: "Lulu",
		title: "the Fae Sorceress",
		tags: ["Support", "Mage"],
		imageFull: "Lulu.png",
	},
]

const SPELLS: SummonerSpellStatic[] = [
	{ id: "SummonerBoost", key: 1, name: "Cleanse", imageFull: "SummonerBoost.png" },
	{ id: "SummonerExhaust", key: 3, name: "Exhaust", imageFull: "SummonerExhaust.png" },
	{ id: "SummonerFlash", key: 4, name: "Flash", imageFull: "SummonerFlash.png" },
	{ id: "SummonerHaste", key: 6, name: "Ghost", imageFull: "SummonerHaste.png" },
	{ id: "SummonerHeal", key: 7, name: "Heal", imageFull: "SummonerHeal.png" },
	{ id: "SummonerSmite", key: 11, name: "Smite", imageFull: "SummonerSmite.png" },
	{ id: "SummonerTeleport", key: 12, name: "Teleport", imageFull: "SummonerTeleport.png" },
	{ id: "SummonerDot", key: 14, name: "Ignite", imageFull: "SummonerDot.png" },
	{ id: "SummonerBarrier", key: 21, name: "Barrier", imageFull: "SummonerBarrier.png" },
]

/* minimal rune catalog covering the runes referenced by FIXTURE_BUILD */
const RUNES: DDragonBundle["runesById"][number][] = [
	{
		id: 8010,
		key: "Conqueror",
		name: "Conqueror",
		icon: "perk-images/Styles/Precision/Conqueror/Conqueror.png",
	},
	{
		id: 9111,
		key: "Triumph",
		name: "Triumph",
		icon: "perk-images/Styles/Precision/Triumph.png",
	},
	{
		id: 9104,
		key: "LegendAlacrity",
		name: "Legend: Alacrity",
		icon: "perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png",
	},
	{
		id: 8014,
		key: "CoupDeGrace",
		name: "Coup de Grace",
		icon: "perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png",
	},
	{
		id: 8473,
		key: "BonePlating",
		name: "Bone Plating",
		icon: "perk-images/Styles/Resolve/BonePlating/BonePlating.png",
	},
	{
		id: 8242,
		key: "Unflinching",
		name: "Unflinching",
		icon: "perk-images/Styles/Resolve/Unflinching/Unflinching.png",
	},
	{
		id: 5005,
		key: "AttackSpeed",
		name: "Attack Speed",
		icon: "perk-images/StatMods/StatModsAttackSpeedIcon.png",
	},
	{
		id: 5008,
		key: "AdaptiveForce",
		name: "Adaptive Force",
		icon: "perk-images/StatMods/StatModsAdaptiveForceIcon.png",
	},
	{
		id: 5011,
		key: "Health",
		name: "Health",
		icon: "perk-images/StatMods/StatModsHealthScalingIcon.png",
	},
]

/* minimal item catalog covering the items referenced by FIXTURE_BUILD */
const ITEMS: DDragonBundle["itemsById"][number][] = [
	{ id: 1054, name: "Doran's Shield", imageFull: "1054.png" },
	{ id: 2003, name: "Health Potion", imageFull: "2003.png" },
	{ id: 3047, name: "Plated Steelcaps", imageFull: "3047.png" },
	{ id: 6630, name: "Goredrinker", imageFull: "6630.png" },
	{ id: 3071, name: "Black Cleaver", imageFull: "3071.png" },
	{ id: 6333, name: "Death's Dance", imageFull: "6333.png" },
	{ id: 3053, name: "Sterak's Gage", imageFull: "3053.png" },
	{ id: 3065, name: "Spirit Visage", imageFull: "3065.png" },
	{ id: 3156, name: "Maw of Malmortius", imageFull: "3156.png" },
	{ id: 3742, name: "Dead Man's Plate", imageFull: "3742.png" },
	{ id: 3026, name: "Guardian Angel", imageFull: "3026.png" },
	{ id: 3033, name: "Mortal Reminder", imageFull: "3033.png" },
]

export const FIXTURE_BUNDLE: DDragonBundle = {
	version: "14.10.1", // pinned mock version (data.js:6); real version resolved in Phase 4
	championsByKey: Object.fromEntries(CHAMPIONS.map((c) => [c.key, c])),
	spellsByKey: Object.fromEntries(SPELLS.map((s) => [s.key, s])),
	runesById: Object.fromEntries(RUNES.map((r) => [r.id, r])),
	itemsById: Object.fromEntries(ITEMS.map((i) => [i.id, i])),
}

/* champion key shorthands */
export const C = {
	aatrox: 266,
	fiora: 114,
	darius: 122,
	quinn: 133,
	camille: 164,
	renekton: 58,
	sett: 875,
	garen: 86,
	ahri: 103,
	yasuo: 157,
	leesin: 64,
	khazix: 121,
	jinx: 222,
	caitlyn: 51,
	thresh: 412,
	lulu: 117,
} as const

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

export const FIXTURE_NOTES: MatchupNote[] = [
	{
		id: "n1",
		championId: C.aatrox,
		opponentChampionId: C.fiora,
		body: "Respect her Riposte on your Q3. Freeze near tower early, all-in after she uses Parry. Don't waste your sweetspot into her W. Bait it first.",
		pinnedSpells: [4, 12],
		createdAt: daysAgo(9),
		updatedAt: daysAgo(2),
	},
	{
		id: "n2",
		championId: C.aatrox,
		opponentChampionId: C.darius,
		body: "Short trades only. Your Q outranges his pull, so poke and disengage. Don't get greedy at 5 stacks; back off if he lands his E.",
		pinnedSpells: [4, 14],
		createdAt: daysAgo(12),
		updatedAt: daysAgo(5),
	},
	{
		id: "n3",
		championId: C.ahri,
		opponentChampionId: C.yasuo,
		body: "Charm is everything. Hold it for when his Windwall is down. Roam mid-to-bot on your first back; he can't follow fast.",
		pinnedSpells: [4, 12],
		createdAt: daysAgo(14),
		updatedAt: daysAgo(7),
	},
	{
		id: "n4",
		championId: C.leesin,
		opponentChampionId: null,
		body: "Red-side full clear into gank topside. Ward your own raptors at 3:00; the enemy jungler loves the invade here.",
		pinnedSpells: [4, 11],
		createdAt: daysAgo(20),
		updatedAt: daysAgo(7),
	},
	{
		id: "n5",
		championId: C.thresh,
		opponentChampionId: C.lulu,
		body: "Hook priority on the enchanter, not the ADC. Lantern timing wins the 2v2, so don't flay the wrong target.",
		pinnedSpells: [4, 14],
		createdAt: daysAgo(21),
		updatedAt: daysAgo(14),
	},
	{
		id: "n6",
		championId: C.jinx,
		opponentChampionId: C.caitlyn,
		body: "Lose level 1-2, scale past it. Hold rockets for when she steps up to trap. Don't walk into the bush she warded.",
		pinnedSpells: [4, 7],
		createdAt: daysAgo(28),
		updatedAt: daysAgo(21),
	},
]

export const FIXTURE_BANLIST: BanListEntry[] = [
	{ championId: C.fiora, priority: 1, reason: "Lane bully, hard to itemize against" },
	{ championId: C.darius, priority: 2, reason: "Snowballs the lane on a single kill" },
	{ championId: C.camille, priority: 3, reason: "Outscales, hooks me to tower" },
	{ championId: C.quinn, priority: 4, reason: "Ranged top, miserable matchup" },
	{ championId: C.yasuo, priority: 5, reason: "Roams mid, ints my jungler" },
]

export const FIXTURE_SETTINGS: AppSettings = {
	...DEFAULT_SETTINGS,
	mains: [
		{ championId: C.aatrox, role: "top" },
		{ championId: C.renekton, role: "top" },
		{ championId: C.leesin, role: "jungle" },
	],
}

/* my team — cellIds 0-4, me = cell 2 (PRD §17 appendix) */
export const ME_CELL_ID = 2
export interface FixturePlayer {
	cellId: number
	championId: number
	position: string
	puuid: string
	summonerId: number
	gameName: string
}
export const MY_TEAM: FixturePlayer[] = [
	{
		cellId: 0,
		championId: C.leesin,
		position: "jungle",
		puuid: "p-wardenz",
		summonerId: 101,
		gameName: "wardenz",
	},
	{
		cellId: 1,
		championId: C.ahri,
		position: "middle",
		puuid: "p-foxfire",
		summonerId: 102,
		gameName: "foxfire",
	},
	{
		cellId: 2,
		championId: C.aatrox,
		position: "top",
		puuid: "p-me",
		summonerId: 103,
		gameName: "lategame andy",
	},
	{
		cellId: 3,
		championId: C.jinx,
		position: "bottom",
		puuid: "p-zapzap",
		summonerId: 104,
		gameName: "zap zap",
	},
	{
		cellId: 4,
		championId: C.thresh,
		position: "utility",
		puuid: "p-hook",
		summonerId: 105,
		gameName: "hook or feed",
	},
]
/* enemy identities exist on the fixtures (known once the game starts); the
   champ select scenario blanks them (scenario.ts), mirroring the LCU's masking */
export const THEIR_TEAM: FixturePlayer[] = [
	{
		cellId: 5,
		championId: C.fiora,
		position: "top",
		puuid: "p-riposte",
		summonerId: 201,
		gameName: "riposte enjoyer",
	},
	{
		cellId: 6,
		championId: C.khazix,
		position: "jungle",
		puuid: "p-bugs",
		summonerId: 202,
		gameName: "isolated target",
	},
	{
		cellId: 7,
		championId: C.yasuo,
		position: "middle",
		puuid: "p-windwall",
		summonerId: 203,
		gameName: "0 and 10 spike",
	},
	{
		cellId: 8,
		championId: C.caitlyn,
		position: "bottom",
		puuid: "p-headshot",
		summonerId: 204,
		gameName: "trap city",
	},
	{
		cellId: 9,
		championId: C.lulu,
		position: "utility",
		puuid: "p-whimsy",
		summonerId: 205,
		gameName: "pix and chill",
	},
]

/* ranks — 4 around Gold/Plat, one Diamond so the mismatch flag has a reason (data.js:91) */
export const FIXTURE_RANKS: Record<string, RankInfo | null> = {
	"p-me": { tier: "EMERALD", division: "IV", lp: 12, queueType: "RANKED_SOLO_5x5" },
	"p-wardenz": { tier: "PLATINUM", division: "III", lp: 41, queueType: "RANKED_SOLO_5x5" },
	"p-foxfire": { tier: "GOLD", division: "II", lp: 67, queueType: "RANKED_SOLO_5x5" },
	"p-zapzap": { tier: "DIAMOND", division: "IV", lp: 8, queueType: "RANKED_SOLO_5x5" },
	"p-hook": { tier: "GOLD", division: "IV", lp: 23, queueType: "RANKED_SOLO_5x5" },
	// their team — visible in-game only (enemy puuids are blank during champ select)
	"p-riposte": { tier: "EMERALD", division: "III", lp: 55, queueType: "RANKED_SOLO_5x5" },
	"p-bugs": { tier: "PLATINUM", division: "I", lp: 72, queueType: "RANKED_SOLO_5x5" },
	"p-windwall": { tier: "EMERALD", division: "IV", lp: 1, queueType: "RANKED_SOLO_5x5" },
	"p-headshot": { tier: "GOLD", division: "I", lp: 88, queueType: "RANKED_SOLO_5x5" },
	"p-whimsy": { tier: "PLATINUM", division: "II", lp: 30, queueType: "RANKED_SOLO_5x5" },
}

export const FIXTURE_SUMMONER: SummonerIdentity = {
	gameName: "lategame andy",
	tagLine: "EUW",
	profileIconId: 4567,
	summonerLevel: 312,
	puuid: "p-me",
}

/* in-game rosters mirror the champ select carry-over: everything revealed,
   enemy identities blank (the LCU masks them) */
const inGamePlayer = (p: FixturePlayer, team: 1 | 2): ChampSelectPlayer => ({
	cellId: p.cellId,
	championId: p.championId,
	championPickIntent: 0,
	assignedPosition: p.position,
	summonerId: p.summonerId,
	puuid: p.puuid,
	gameName: p.gameName || undefined,
	spell1Id: team === 1 ? 4 : 0,
	spell2Id: team === 1 ? 12 : 0,
	team,
})

export const FIXTURE_IN_GAME: InGameState = {
	championId: C.aatrox,
	spell1Id: 4, // Flash
	spell2Id: 12, // Teleport
	queueId: 420, // Ranked Solo
	assignedPosition: "top",
	opponentChampionId: C.fiora,
	myTeam: MY_TEAM.map((p) => inGamePlayer(p, 1)),
	theirTeam: THEIR_TEAM.map((p) => inGamePlayer(p, 2)),
}

/* Aatrox Q/W/E/R — real DDragon image names so icons load from the CDN in dev */
export const FIXTURE_ABILITIES: ChampionAbilities = {
	championKey: C.aatrox,
	abilities: [
		{ key: "Q", name: "The Darkin Blade", imageFull: "AatroxQ.png" },
		{ key: "W", name: "Infernal Chains", imageFull: "AatroxW.png" },
		{ key: "E", name: "Umbral Dash", imageFull: "AatroxE.png" },
		{ key: "R", name: "World Ender", imageFull: "AatroxR.png" },
	],
	passive: { name: "Deathbringer Stance", imageFull: "Aatrox_Passive.png" },
}

/* a complete Aatrox-top build the in-game + champ-select panels render against */
export const FIXTURE_BUILD: BuildRecommendation = {
	championKey: C.aatrox,
	role: "top",
	patch: "14.10",
	winRate: 0.512,
	sampleSize: 84213,
	runes: {
		primaryStyleId: 8000, // Precision
		subStyleId: 8400, // Resolve
		// [keystone, p1, p2, p3, s1, s2, shard1, shard2, shard3]
		selectedPerkIds: [8010, 9111, 9104, 8014, 8473, 8242, 5005, 5008, 5011],
		primaryName: "Precision",
		secondaryName: "Resolve",
	},
	spells: [4, 12], // Flash, Teleport
	items: {
		starter: { ids: [1054, 2003], winRate: 0.515, pickRate: 0.62 },
		boots: { ids: [3047], winRate: 0.518, pickRate: 0.71 },
		core: { ids: [6630, 3071, 6333], winRate: 0.531, pickRate: 0.44 },
		fourth: [
			{ id: 3053, winRate: 0.547, pickRate: 0.31 },
			{ id: 3065, winRate: 0.534, pickRate: 0.24 },
			{ id: 3156, winRate: 0.521, pickRate: 0.18 },
		],
		fifth: [
			{ id: 3065, winRate: 0.556, pickRate: 0.27 },
			{ id: 3742, winRate: 0.538, pickRate: 0.21 },
			{ id: 3156, winRate: 0.525, pickRate: 0.16 },
		],
		sixth: [
			{ id: 3026, winRate: 0.561, pickRate: 0.29 },
			{ id: 3742, winRate: 0.54, pickRate: 0.19 },
			{ id: 3033, winRate: 0.528, pickRate: 0.14 },
		],
	},
	// 18 entries: Q maxed first, then E, then W; R at 6/11/16
	skillOrder: [
		"Q",
		"E",
		"W",
		"Q",
		"Q",
		"R",
		"Q",
		"E",
		"Q",
		"E",
		"R",
		"E",
		"E",
		"W",
		"W",
		"R",
		"W",
		"W",
	],
	skillPriority: ["Q", "E", "W"],
}

/* counter tables for the live fake matchup (Aatrox vs Fiora, top).
   winRate is the TABLE OWNER's — display flips it. */
export const FIXTURE_COUNTERS: Record<number, CounterTable> = {
	[C.fiora]: {
		championKey: C.fiora,
		role: "top",
		patch: "14.10",
		weakAgainst: [
			{ championId: C.quinn, winRate: 0.44, games: 310 },
			{ championId: C.renekton, winRate: 0.46, games: 1480 },
			{ championId: C.garen, winRate: 0.47, games: 1820 },
			{ championId: C.sett, winRate: 0.485, games: 960 },
		],
		strongAgainst: [
			{ championId: C.aatrox, winRate: 0.54, games: 1620 },
			{ championId: C.camille, winRate: 0.53, games: 890 },
		],
	},
	[C.aatrox]: {
		championKey: C.aatrox,
		role: "top",
		patch: "14.10",
		weakAgainst: [
			{ championId: C.fiora, winRate: 0.46, games: 1620 },
			{ championId: C.darius, winRate: 0.465, games: 2210 },
			{ championId: C.camille, winRate: 0.47, games: 890 },
			{ championId: C.sett, winRate: 0.475, games: 1040 },
			{ championId: C.garen, winRate: 0.48, games: 1530 },
		],
		strongAgainst: [
			{ championId: C.quinn, winRate: 0.52, games: 410 },
			{ championId: C.yasuo, winRate: 0.53, games: 260 },
		],
	},
}
