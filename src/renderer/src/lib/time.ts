/* "2d ago"-style labels for note timestamps (prototype data.js `updated`) */
export function timeAgo(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime()
	const m = Math.floor(ms / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ago`
	const d = Math.floor(h / 24)
	if (d < 7) return `${d}d ago`
	const w = Math.floor(d / 7)
	return `${w}w ago`
}
