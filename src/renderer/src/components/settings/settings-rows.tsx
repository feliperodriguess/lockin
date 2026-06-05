// settings.jsx:7-40 — Group (Eyebrow + Card wrapper) and Row (title/desc/control).
// Group: Eyebrow line=22 + Card padding "4px 16px".
// Row: flex row, py 15px, bottom border stroke-subtle unless last;
//   title 500 14px fg-1; desc 400 12px/1.45 fg-4 maxW 380.

import { Card } from "@renderer/components/app/card"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { cn } from "@renderer/lib/utils"

interface GroupProps {
	label: string
	children: React.ReactNode
}

export function Group({ label, children }: GroupProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-3">
			<Eyebrow line={22}>{label}</Eyebrow>
			<Card className="px-4 py-1">{children}</Card>
		</div>
	)
}

interface RowProps {
	title: string
	desc?: string
	control: React.ReactNode
	last?: boolean
}

export function Row({ title, desc, control, last }: RowProps): React.JSX.Element {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-5 py-[15px]",
				!last && "border-b border-[var(--stroke-subtle)]",
			)}
		>
			<div className="flex min-w-0 flex-col gap-[3px]">
				<span className="text-[14px] font-medium leading-[1.2] text-paper-100">{title}</span>
				{desc && (
					<span className="max-w-[380px] text-[12px] leading-[1.45] text-paper-400">{desc}</span>
				)}
			</div>
			<div className="shrink-0">{control}</div>
		</div>
	)
}
