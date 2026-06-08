import { Card } from "@renderer/components/app/card"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { cn } from "@renderer/lib/utils"
import type { ReactNode } from "react"

interface SectionProps {
	label: string
	right?: ReactNode
	emphasis?: boolean
	grow?: boolean
	scroll?: boolean
	className?: string
	children: ReactNode
}

export function Section({
	label,
	right,
	emphasis,
	grow,
	scroll,
	className,
	children,
}: SectionProps): React.JSX.Element {
	return (
		<Card
			emphasis={emphasis}
			className={cn(
				"flex min-h-0 flex-col overflow-hidden p-4 gap-[11.2px]",
				{ "flex-1": grow },
				className,
			)}
		>
			<header className="flex shrink-0 items-center justify-between gap-2">
				<Eyebrow line={20}>{label}</Eyebrow>
				{right}
			</header>
			<div
				className={cn(
					"flex min-h-0 flex-1 flex-col",
					scroll ? "overflow-y-auto -mx-1" : "overflow-hidden",
				)}
			>
				{children}
			</div>
		</Card>
	)
}
