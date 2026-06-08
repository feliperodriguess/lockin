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
				"bg-ink-950 border border-(--stroke-default) rounded-sm",
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
							"transition-[background-color,color] duration-(--dur-base) ease-(--ease-standard)",
							selected
								? "bg-accent text-accent-fg"
								: "bg-transparent text-(--fg-2) hover:text-(--fg-1)",
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
