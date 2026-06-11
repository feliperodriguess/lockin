import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@renderer/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"group/switch relative inline-flex shrink-0 items-center",
				"w-[38px] h-[22px] rounded-full border-0 p-[2px]",
				"outline-none cursor-pointer",
				"transition-[background-color] duration-(--dur-base) ease-(--ease-standard)",
				"data-checked:bg-accent data-unchecked:bg-ink-700",
				"focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0",
				"data-disabled:cursor-not-allowed data-disabled:opacity-40",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"pointer-events-none block size-[18px] rounded-full",
					"transition-[translate,background-color] duration-(--dur-base) ease-(--ease-emphasized)",
					"motion-reduce:transition-[background-color]",
					"data-checked:translate-x-[16px] data-checked:bg-ink-950",
					"data-unchecked:translate-x-0 data-unchecked:bg-paper-200",
				)}
			/>
		</SwitchPrimitive.Root>
	)
}

export { Switch }
