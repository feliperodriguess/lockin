// settings.jsx:43-78 — Segmented control.
// Container: ink-950 bg, border stroke-default, radius-sm, padding 3, gap 2.
// Option buttons: 5px 12px padding, radius 4, 600 12px font-ui.
// Selected: accent bg + accent-fg; else: transparent + fg-2.
// Generic value/options/onChange — option shape: { value: T; label: string }.

import { cn } from "@renderer/lib/utils"

export interface SegmentedOption<T> {
	value: T
	label: string
}

interface SegmentedProps<T> {
	value: T
	options: SegmentedOption<T>[]
	onChange: (value: T) => void
	className?: string
}

function Segmented<T extends string | number>({
	value,
	options,
	onChange,
	className,
}: SegmentedProps<T>): React.JSX.Element {
	return (
		<div
			className={cn(
				"inline-flex p-[3px] gap-[2px]",
				"bg-[var(--color-ink-950)] border border-[var(--stroke-default)] rounded-[var(--radius-sm)]",
				className,
			)}
		>
			{options.map((opt) => {
				const selected = value === opt.value
				return (
					<button
						key={String(opt.value)}
						type="button"
						onClick={() => onChange(opt.value)}
						className={cn(
							"px-3 py-[5px] rounded-[4px] border-0 cursor-pointer",
							"text-[12px] font-semibold leading-none",
							"transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-standard)]",
							selected
								? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
								: "bg-transparent text-[var(--fg-2)] hover:text-[var(--fg-1)]",
						)}
					>
						{opt.label}
					</button>
				)
			})}
		</div>
	)
}

export { Segmented }
