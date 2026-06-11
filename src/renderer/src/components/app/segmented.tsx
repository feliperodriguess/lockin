import { tweenBase } from "@renderer/lib/motion"
import { cn } from "@renderer/lib/utils"
import { motion } from "motion/react"
import { useId } from "react"

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
	const pillId = useId()
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
							"relative px-3 py-[5px] rounded-[4px] border-0 cursor-pointer",
							"text-[12px] font-semibold leading-none",
							"transition-colors duration-(--dur-base) ease-(--ease-standard)",
							selected ? "text-accent-fg" : "text-(--fg-2) hover:text-(--fg-1)",
						)}
					>
						{selected && (
							<motion.span
								layoutId={pillId}
								transition={tweenBase}
								className="absolute inset-0 rounded-[4px] bg-accent"
							/>
						)}
						<span className="relative">{opt.label}</span>
					</button>
				)
			})}
		</div>
	)
}

export { Segmented }
