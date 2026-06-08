import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cn } from "@renderer/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
	[
		"inline-flex shrink-0 items-center justify-center gap-[7px]",
		"rounded-[var(--radius-sm)] border font-semibold whitespace-nowrap",
		"transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)]",
		"outline-none select-none cursor-pointer",
		"focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0",
		"disabled:cursor-not-allowed disabled:bg-[var(--color-ink-700)] disabled:text-[var(--color-paper-500)] disabled:border-transparent",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0",
	].join(" "),
	{
		variants: {
			variant: {
				default: [
					"bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent",
					"hover:not-disabled:bg-[var(--color-accent-strong)]",
					"active:not-disabled:bg-[var(--color-accent-press)] active:not-disabled:scale-[0.98]",
				].join(" "),
				secondary: [
					"bg-[var(--bg-raised)] text-[var(--fg-1)] border-[var(--stroke-default)]",
					"hover:not-disabled:bg-[var(--bg-hover)]",
					"active:not-disabled:bg-[var(--color-ink-700)]",
				].join(" "),
				ghost: [
					"bg-transparent text-[var(--fg-2)] border-transparent",
					"hover:not-disabled:bg-[rgba(255,255,255,0.05)]",
					"active:not-disabled:bg-[var(--bg-hover)]",
				].join(" "),
				destructive: [
					"bg-transparent text-[var(--color-fail)] border-[rgba(255,107,94,0.28)]",
					"hover:not-disabled:bg-[rgba(255,107,94,0.08)]",
					"active:not-disabled:bg-[rgba(255,107,94,0.14)]",
				].join(" "),
				outline: [
					"bg-[var(--bg-raised)] text-[var(--fg-1)] border-[var(--stroke-default)]",
					"hover:not-disabled:bg-[var(--bg-hover)]",
				].join(" "),
				link: "bg-transparent border-transparent text-[var(--color-accent)] underline-offset-4 hover:underline",
			},
			size: {
				sm: "h-7 px-2.5 text-xs",
				default: "h-[34px] px-3.5 text-[13px]",
				lg: "h-[42px] px-5 text-[15px]",
				icon: "size-[34px] p-0",
				"icon-sm": "size-7 p-0",
				"icon-lg": "size-[42px] p-0",
				xs: "h-6 px-2 text-xs",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	)
}

export { Button, buttonVariants }
