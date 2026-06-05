import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@renderer/lib/utils"

// Primitives.jsx:384-418 — Toggle: 38×22, padding 2, checked=accent / unchecked=ink-700,
// thumb 18px (checked: ink-950 bg, translateX 16px; unchecked: paper-200).
// dur-base transition on both track and thumb.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				// track: 38×22, rounded-full, padding 2 via inline structure
				"group/switch relative inline-flex shrink-0 items-center",
				"w-[38px] h-[22px] rounded-full border-0 p-[2px]",
				"outline-none cursor-pointer",
				"transition-[background-color] duration-[var(--dur-base)] ease-[var(--ease-standard)]",
				// checked = accent, unchecked = ink-700
				"data-checked:bg-[var(--color-accent)] data-unchecked:bg-[var(--color-ink-700)]",
				// focus-visible ring
				"focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0",
				// disabled
				"data-disabled:cursor-not-allowed data-disabled:opacity-40",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					// thumb: 18×18, rounded-full
					"pointer-events-none block size-[18px] rounded-full",
					"transition-[transform,background-color] duration-[var(--dur-base)] ease-[var(--ease-standard)]",
					// checked: ink-950 bg, translate 16px; unchecked: paper-200, translate 0
					"data-checked:translate-x-[16px] data-checked:bg-[var(--color-ink-950)]",
					"data-unchecked:translate-x-0 data-unchecked:bg-[var(--color-paper-200)]",
				)}
			/>
		</SwitchPrimitive.Root>
	)
}

export { Switch }
