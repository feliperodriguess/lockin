/* =========================================================================
   Champ Co-Pilot — sample data + Data Dragon helpers
   Real-feeling League content for the mockups. Art from Riot's Data Dragon CDN.
   ========================================================================= */

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img"
const ddChamp = (k) => `${DDRAGON}/champion/${k}.png`
const ddChampLoading = (k) =>
	`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${k}_0.jpg`
const ddChampSplash = (k) =>
	`https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${k}_0.jpg`
const ddSpell = (k) => `${DDRAGON}/spell/${k}.png`
const ddItem = (id) => `${DDRAGON}/item/${id}.png`

/* ----------------------------- Champions ------------------------------- */
/* color = on-brand fallback tile tint (used if CDN art fails to load).     */
const CHAMPIONS = [
	{ key: "Aatrox", name: "Aatrox", title: "the Darkin Blade", role: "Top", color: "#7a2b2b" },
	{ key: "Fiora", name: "Fiora", title: "the Grand Duelist", role: "Top", color: "#8a3a52" },
	{ key: "Darius", name: "Darius", title: "the Hand of Noxus", role: "Top", color: "#6e3326" },
	{ key: "Quinn", name: "Quinn", title: "Demacia's Wings", role: "Top", color: "#3f6e4a" },
	{ key: "Camille", name: "Camille", title: "the Steel Shadow", role: "Top", color: "#3a5a6e" },
	{ key: "Renekton", name: "Renekton", title: "the Butcher", role: "Top", color: "#8a5a2b" },
	{ key: "Sett", name: "Sett", title: "the Boss", role: "Top", color: "#8a4a4a" },
	{ key: "Garen", name: "Garen", title: "the Might of Demacia", role: "Top", color: "#4a6a8a" },
	{ key: "Ahri", name: "Ahri", title: "the Nine-Tailed Fox", role: "Mid", color: "#8a3a6e" },
	{ key: "Yasuo", name: "Yasuo", title: "the Unforgiven", role: "Mid", color: "#3a6a8a" },
	{ key: "LeeSin", name: "Lee Sin", title: "the Blind Monk", role: "Jungle", color: "#8a6a2b" },
	{ key: "Khazix", name: "Kha'Zix", title: "the Voidreaver", role: "Jungle", color: "#5a3a7a" },
	{ key: "Jinx", name: "Jinx", title: "the Loose Cannon", role: "Bot", color: "#7a3a6a" },
	{ key: "Caitlyn", name: "Caitlyn", title: "the Sheriff", role: "Bot", color: "#7a5a3a" },
	{ key: "Thresh", name: "Thresh", title: "the Chain Warden", role: "Support", color: "#2b6e5a" },
	{ key: "Lulu", name: "Lulu", title: "the Fae Sorceress", role: "Support", color: "#6e4a8a" },
]
const champ = (key) => CHAMPIONS.find((c) => c.key === key)

/* --------------------------- Summoner spells --------------------------- */
const SPELLS = {
	Flash: { key: "SummonerFlash", name: "Flash" },
	Teleport: { key: "SummonerTeleport", name: "Teleport" },
	Ignite: { key: "SummonerDot", name: "Ignite" },
	Smite: { key: "SummonerSmite", name: "Smite" },
	Heal: { key: "SummonerHeal", name: "Heal" },
	Exhaust: { key: "SummonerExhaust", name: "Exhaust" },
}

/* -------------------------------- Items -------------------------------- */
const ITEMS = {
	doransBlade: { id: 1055, name: "Doran's Blade" },
	doransRing: { id: 1056, name: "Doran's Ring" },
	doransShield: { id: 1054, name: "Doran's Shield" },
	healthPotion: { id: 2003, name: "Health Potion" },
	refillable: { id: 2031, name: "Refillable Potion" },
	jungleStarter: { id: 1102, name: "Mosstomper Seedling" },
}

/* -------------------------------- Ranks -------------------------------- */
/* Drawn with our own emblem (not Riot's), tinted per tier.                 */
const TIERS = {
	Iron: { idx: 0, color: "#6b6258", label: "Iron" },
	Bronze: { idx: 1, color: "#9c6b43", label: "Bronze" },
	Silver: { idx: 2, color: "#9aa6ad", label: "Silver" },
	Gold: { idx: 3, color: "#e0b441", label: "Gold" },
	Platinum: { idx: 4, color: "#4fb6a6", label: "Platinum" },
	Emerald: { idx: 5, color: "#46c279", label: "Emerald" },
	Diamond: { idx: 6, color: "#7aa2ff", label: "Diamond" },
	Master: { idx: 7, color: "#c77dff", label: "Master" },
	Grandmaster: { idx: 8, color: "#ff6b5e", label: "Grandmaster" },
	Challenger: { idx: 9, color: "#d6ff66", label: "Challenger" },
}
const rank = (tier, div, lp) => ({ tier, div, lp })
const rankIdx = (r) => (r?.tier ? TIERS[r.tier].idx * 4 + (4 - (r.div || 4)) : -1)
const fmtRank = (r) => {
	if (!r || r.status === "unranked") return "Unranked"
	if (r.status === "provisional") return `Provisional · ${r.games || 3}/5`
	const div = ["", "I", "II", "III", "IV"][r.div]
	return `${TIERS[r.tier].label} ${div} · ${r.lp} LP`
}

/* ------------------------------- The player ---------------------------- */
const ME = {
	summoner: "lategame andy",
	champ: "Aatrox",
	role: "Top",
	rank: rank("Emerald", 4, 12),
	spells: ["Flash", "Teleport"],
}

/* ----------------------------- The team -------------------------------- */
/* Four around Gold/Plat, one Diamond — so the mismatch flag has a reason.  */
const TEAM = [
	{
		role: "Top",
		champ: "Aatrox",
		summoner: "lategame andy",
		rank: rank("Emerald", 4, 12),
		you: true,
	},
	{ role: "Jungle", champ: "LeeSin", summoner: "wardenz", rank: rank("Platinum", 3, 41) },
	{ role: "Mid", champ: "Ahri", summoner: "foxfire", rank: rank("Gold", 2, 67) },
	{ role: "Bot", champ: "Jinx", summoner: "zap zap", rank: rank("Diamond", 4, 8) },
	{ role: "Support", champ: "Thresh", summoner: "hook or feed", rank: rank("Gold", 4, 23) },
]

/* ------------------------------- Notes --------------------------------- */
const NOTES = [
	{
		id: "n1",
		champ: "Aatrox",
		opponent: "Fiora",
		updated: "2d ago",
		body: "Respect her Riposte on your Q3. Freeze near tower early, all-in after she uses Parry. Don't waste your sweetspot into her W — bait it first.",
		spells: ["Flash", "Teleport"],
		items: ["doransBlade", "healthPotion"],
	},
	{
		id: "n2",
		champ: "Aatrox",
		opponent: "Darius",
		updated: "5d ago",
		body: "Short trades only. Your Q outranges his pull — poke and disengage. Don't get greedy at 5 stacks; back off if he lands his E.",
		spells: ["Flash", "Ignite"],
		items: ["doransShield", "healthPotion"],
	},
	{
		id: "n3",
		champ: "Ahri",
		opponent: "Yasuo",
		updated: "1w ago",
		body: "Charm is everything — hold it for when his Windwall is down. Roam mid-to-bot on your first back; he can't follow fast.",
		spells: ["Flash", "Teleport"],
		items: ["doransRing", "healthPotion"],
	},
	{
		id: "n4",
		champ: "LeeSin",
		opponent: null,
		updated: "1w ago",
		body: "Red-side full clear into gank topside. Ward your own raptors at 3:00 — enemy jungler loves the invade here.",
		spells: ["Flash", "Smite"],
		items: ["jungleStarter", "refillable"],
	},
	{
		id: "n5",
		champ: "Thresh",
		opponent: "Lulu",
		updated: "2w ago",
		body: "Hook priority on the enchanter, not the ADC. Lantern timing wins the 2v2 — don't flay the wrong target.",
		spells: ["Flash", "Ignite"],
		items: [],
	},
	{
		id: "n6",
		champ: "Jinx",
		opponent: "Caitlyn",
		updated: "3w ago",
		body: "Lose level 1-2, scale past it. Hold rockets for when she steps up to trap. Don't walk into the bush she warded.",
		spells: ["Flash", "Heal"],
		items: ["doransBlade", "healthPotion"],
	},
]

/* ----------------------------- Ban list -------------------------------- */
/* The player's prioritized ban list. `status`: available | banned | picked. */
const BANLIST = [
	{
		champ: "Fiora",
		reason: "Lane bully, hard to itemize against",
		status: "available",
		threat: true,
	},
	{ champ: "Darius", reason: "Snowballs the lane on a single kill", status: "available" },
	{ champ: "Camille", reason: "Outscales, hooks me to tower", status: "banned" },
	{ champ: "Quinn", reason: "Ranged top — miserable matchup", status: "available" },
	{ champ: "Yasuo", reason: "Roams mid, ints my jungler", status: "picked" },
]

window.CCP = {
	DDRAGON,
	ddChamp,
	ddChampLoading,
	ddChampSplash,
	ddSpell,
	ddItem,
	CHAMPIONS,
	champ,
	SPELLS,
	ITEMS,
	TIERS,
	rank,
	rankIdx,
	fmtRank,
	ME,
	TEAM,
	NOTES,
	BANLIST,
}
