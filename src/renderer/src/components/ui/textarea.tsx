import { cn } from "@renderer/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"w-full px-3 py-[10px]",
				"bg-ink-950 rounded-sm",
				"border border-(--stroke-default)",
				"text-[13px] text-paper-100 placeholder:text-paper-400",
				"leading-[1.6] resize-y min-h-0",
				"outline-none",
				"transition-[border-color,box-shadow] duration-160 ease-(--ease-standard)",
				"focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent),0_0_16px_var(--accent-glow)]",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	)
}

export { Textarea }
