import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@renderer/lib/utils"
import { Check, ChevronDown } from "lucide-react"

export interface SelectOption<T extends string> {
	value: T
	label: string
	disabled?: boolean
}

interface SelectProps<T extends string> {
	value: T
	options: SelectOption<T>[]
	onChange: (value: T) => void
	disabled?: boolean
	className?: string
}

function Select<T extends string>({
	value,
	options,
	onChange,
	disabled,
	className,
}: SelectProps<T>): React.JSX.Element {
	const labelOf = (v: T): string => options.find((o) => o.value === v)?.label ?? String(v)
	return (
		<SelectPrimitive.Root
			value={value}
			disabled={disabled}
			onValueChange={(next) => onChange(next as T)}
		>
			<SelectPrimitive.Trigger
				data-slot="select-trigger"
				className={cn(
					"inline-flex h-8 min-w-[112px] items-center justify-between gap-2",
					"rounded-sm border border-(--stroke-default) bg-ink-950 px-3",
					"text-[12px] font-semibold leading-none text-(--fg-1)",
					"outline-none cursor-pointer",
					"transition-[border-color] duration-(--dur-base) ease-(--ease-standard)",
					"hover:border-(--stroke-strong) focus-visible:ring-2 focus-visible:ring-accent",
					"data-disabled:cursor-not-allowed data-disabled:opacity-40",
					className,
				)}
			>
				<SelectPrimitive.Value>{(v: T) => labelOf(v)}</SelectPrimitive.Value>
				<SelectPrimitive.Icon className="text-(--fg-4)">
					<ChevronDown size={14} />
				</SelectPrimitive.Icon>
			</SelectPrimitive.Trigger>
			<SelectPrimitive.Portal>
				<SelectPrimitive.Positioner sideOffset={4} align="start" className="z-50">
					<SelectPrimitive.Popup
						className={cn(
							"min-w-(--anchor-width) overflow-hidden rounded-sm p-1",
							"border border-(--stroke-default) bg-ink-900 shadow-lg",
						)}
					>
						{options.map((opt) => (
							<SelectPrimitive.Item
								key={opt.value}
								value={opt.value}
								disabled={opt.disabled}
								className={cn(
									"flex cursor-pointer items-center justify-between gap-3 rounded-[4px]",
									"px-2 py-[6px] text-[12px] font-medium leading-none text-(--fg-2)",
									"outline-none select-none",
									"data-highlighted:bg-accent data-highlighted:text-accent-fg",
									"data-disabled:cursor-not-allowed data-disabled:opacity-40",
								)}
							>
								<SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
								<SelectPrimitive.ItemIndicator>
									<Check size={13} />
								</SelectPrimitive.ItemIndicator>
							</SelectPrimitive.Item>
						))}
					</SelectPrimitive.Popup>
				</SelectPrimitive.Positioner>
			</SelectPrimitive.Portal>
		</SelectPrimitive.Root>
	)
}

export { Select }
