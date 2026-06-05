// Primitives.jsx:454-476 — Card with hover and emphasis props.
// bg-raised, border stroke-default; emphasis: accent border + double accent glow shadow;
// hover: bg-hover when hover prop set; cursor-pointer when onClick given.
// Cards may contain interactive children, so we keep the div with onClick rather
// than wrapping in a button element (matching prototype behavior).

import { cn } from "@renderer/lib/utils"

interface CardProps {
	children: React.ReactNode
	hover?: boolean
	emphasis?: boolean
	onClick?: () => void
	className?: string
}

function Card({ children, hover, emphasis, onClick, className }: CardProps): React.JSX.Element {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: card contains interactive children; role=button is set when onClick is provided
		<div
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={onClick}
			onKeyDown={
				onClick
					? (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault()
								onClick()
							}
						}
					: undefined
			}
			className={cn(
				// base
				"rounded-[var(--radius-md)] border border-[var(--stroke-default)]",
				"bg-[var(--bg-raised)]",
				"transition-[background-color,border-color,box-shadow] duration-[160ms] ease-[var(--ease-standard)]",
				// hover variant: bg-hover when hovered
				hover && "hover:bg-[var(--bg-hover)]",
				// emphasis: accent border + glow shadow
				emphasis && [
					"border-[var(--color-accent)]",
					"shadow-[0_0_0_1px_var(--color-accent),0_0_28px_var(--accent-glow)]",
				],
				// clickable cursor and keyboard focus styles
				onClick && [
					"cursor-pointer",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
				],
				className,
			)}
		>
			{children}
		</div>
	)
}

export { Card }
