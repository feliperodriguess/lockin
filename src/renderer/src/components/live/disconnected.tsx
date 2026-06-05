// live-view.jsx:8-91 — Disconnected state.
// Centered section with halo rings, breathing WifiOff tile, headline, body, and mono footer.

import { WifiOff } from "lucide-react"

export function Disconnected(): React.JSX.Element {
	return (
		<section className="flex h-full flex-col items-center justify-center gap-[22px] text-center">
			{/* halo stack — 92px wrap, two halo rings + 60px breathing circle */}
			<div className="relative grid place-items-center size-[92px]">
				<span className="ccp-halo absolute inset-0 rounded-full border border-[var(--stroke-default)]" />
				<span className="ccp-halo ccp-halo-2 absolute inset-0 rounded-full border border-[var(--stroke-default)]" />
				<div className="ccp-breathe grid place-items-center size-[60px] rounded-full border border-[var(--stroke-default)] bg-ink-850 text-paper-300">
					<WifiOff size={26} strokeWidth={1.5} />
				</div>
			</div>

			{/* text block */}
			<div className="flex flex-col gap-3 max-w-[340px]">
				<p className="m-0 font-display text-[26px] font-normal leading-[1.3] text-paper-100">
					Waiting for the League client…
				</p>
				<p className="m-0 text-[13.5px] leading-[1.55] text-paper-300">
					We'll wake up the moment it opens. Your notes and settings stay available in the meantime.
				</p>
			</div>

			{/* mono footer with breathing dot */}
			<div className="flex items-center gap-2 font-mono text-[11px] font-medium leading-none tracking-[0.04em] text-paper-400">
				<span className="ccp-breathe inline-block size-1.5 rounded-full bg-paper-400" />
				Listening on 127.0.0.1
			</div>
		</section>
	)
}
