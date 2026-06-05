import { cn } from "@renderer/lib/utils"

// Themed input primitive — shadcn-style API with our design tokens.
// h-[34px], ink-950 bg, border stroke-default, rounded-sm, 13px text, paper-100.
// Focus: accent border + double-ring glow shadow — via CSS :focus pseudo, no JS state.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			data-slot="input"
			type={type}
			className={cn(
				"h-[34px] w-full px-3",
				"bg-ink-950 rounded-sm",
				"border border-[var(--stroke-default)]",
				"text-[13px] text-paper-100 placeholder:text-paper-400",
				"outline-none",
				"transition-[border-color,box-shadow] duration-[160ms] ease-[var(--ease-standard)]",
				"focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent),0_0_16px_var(--accent-glow)]",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	)
}

export { Input }
