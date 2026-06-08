interface AppMarkProps {
	size?: number
	radius?: number
}

export function AppMark({ size = 22, radius }: AppMarkProps): React.JSX.Element {
	const r = radius != null ? radius : Math.round(size * 0.27)
	const v = size * 0.68
	return (
		<span
			className="relative overflow-hidden grid place-items-center shrink-0 bg-[linear-gradient(155deg,#24272c_0%,#0b0c0d_78%)] border border-(--stroke-strong) shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
			style={{
				width: size,
				height: size,
				borderRadius: r,
			}}
		>
			<span
				className="[grid-area:1/1] rounded-full"
				style={{
					width: size * 0.78,
					height: size * 0.78,
					background: "radial-gradient(circle, rgba(245,0,61,0.45) 0%, rgba(245,0,61,0) 68%)",
				}}
			/>
			<svg
				width={v}
				height={v}
				viewBox="0 0 24 24"
				aria-label="lockin gem"
				role="img"
				className="[grid-area:1/1] relative block"
			>
				<defs>
					<linearGradient id="lkGem" x1="0" y1="0" x2="0.25" y2="1">
						<stop offset="0" stopColor="#ff5a7d" />
						<stop offset="0.52" stopColor="#f5003d" />
						<stop offset="1" stopColor="#a8002c" />
					</linearGradient>
				</defs>
				<path d="M7.3 3.8 H16.7 L21 9.3 L12 21.2 L3 9.3 Z" fill="url(#lkGem)" />
				<path d="M3 9.3 H21" stroke="#fff" strokeOpacity="0.30" strokeWidth="0.7" />
				<path
					d="M7.3 3.8 L9.4 9.3 L12 21.2 M16.7 3.8 L14.6 9.3 L12 21.2"
					stroke="#fff"
					strokeOpacity="0.16"
					strokeWidth="0.6"
					fill="none"
				/>
				<path d="M8.6 5 H11 L9.9 8.3 Z" fill="#fff" fillOpacity="0.55" />
			</svg>
		</span>
	)
}

interface WordmarkProps {
	size?: number
	mark?: boolean
}

export function Wordmark({ size = 15, mark = true }: WordmarkProps): React.JSX.Element {
	return (
		<span className="inline-flex items-center" style={{ gap: size * 0.5 }}>
			{mark && <AppMark size={size * 1.55} />}
			<span
				className="text-paper-100 font-semibold tracking-[-0.015em] leading-none"
				style={{ fontSize: size }}
			>
				lockin
			</span>
		</span>
	)
}
