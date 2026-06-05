// champ-select-parts.jsx:20-61 — Card + Eyebrow shell for each champ-select region.
// Cozy density is locked (D14): pad 16, header→body gap pad*0.7 = 11.2.
// Header row: Eyebrow (line=20) + optional `right` slot; body is a flex column
// that grows to fill, min-height 0 so it can scroll. When `scroll`, the body
// gets overflow-y auto + the -4px horizontal margin trick so the scrollbar sits
// flush with the card padding.

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
			// cozy density (D14): pad 16 (p-4), header→body gap pad*0.7 = 11.2px
			className={cn(
				"flex min-h-0 flex-col overflow-hidden p-4 gap-[11.2px]",
				grow && "flex-1",
				className,
			)}
		>
			<header className="flex shrink-0 items-center justify-between gap-2">
				<Eyebrow line={20}>{label}</Eyebrow>
				{right}
			</header>
			<div
				className="flex min-h-0 flex-1 flex-col"
				style={{
					overflowY: scroll ? "auto" : "hidden",
					margin: scroll ? "0 -4px" : 0,
				}}
			>
				{children}
			</div>
		</Card>
	)
}
