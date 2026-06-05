// live-view.jsx:8-91 — Disconnected state.
// Centered section with halo rings, breathing WifiOff tile, headline, body, and mono footer.

import { WifiOff } from "lucide-react"

export function Disconnected(): React.JSX.Element {
	return (
		<section className="flex h-full flex-col items-center justify-center gap-[22px] text-center">
			{/* halo stack — 92px wrap, two halo rings + 60px breathing circle */}
			<div className="relative grid place-items-center" style={{ width: 92, height: 92 }}>
				<span className="ccp-halo absolute inset-0 rounded-full border border-[var(--stroke-default)]" />
				<span className="ccp-halo ccp-halo-2 absolute inset-0 rounded-full border border-[var(--stroke-default)]" />
				<div
					className="ccp-breathe grid place-items-center rounded-full border border-[var(--stroke-default)] bg-ink-850 text-[var(--fg-3)]"
					style={{ width: 60, height: 60 }}
				>
					<WifiOff size={26} strokeWidth={1.5} />
				</div>
			</div>

			{/* text block */}
			<div className="flex flex-col gap-3" style={{ maxWidth: 340 }}>
				<div style={{ font: "400 26px/1.3 var(--font-display)", color: "var(--fg-1)" }}>
					Waiting for the League client…
				</div>
				<div style={{ font: "400 13.5px/1.55 var(--font-ui)", color: "var(--fg-3)" }}>
					We'll wake up the moment it opens. Your notes and settings stay available in the meantime.
				</div>
			</div>

			{/* mono footer with breathing dot */}
			<div
				className="flex items-center gap-2"
				style={{
					font: "500 11px/1 var(--font-mono)",
					letterSpacing: "0.04em",
					color: "var(--fg-4)",
				}}
			>
				<span
					className="ccp-breathe inline-block rounded-full bg-[var(--fg-4)]"
					style={{ width: 6, height: 6 }}
				/>
				Listening on 127.0.0.1
			</div>
		</section>
	)
}
