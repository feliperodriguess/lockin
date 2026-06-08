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
				"bg-(--bg-raised) rounded-md border border-(--stroke-default)",
				"transition-[background-color,border-color,box-shadow] duration-160 ease-(--ease-standard)",
				{
					"hover:bg-(--bg-hover)": hover,
					"border-accent shadow-[0_0_0_1px_var(--color-accent),0_0_28px_var(--accent-glow)]":
						emphasis,
					"cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent":
						onClick,
				},
				className,
			)}
		>
			{children}
		</div>
	)
}

export { Card }
