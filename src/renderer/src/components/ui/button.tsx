import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cn } from "@renderer/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

// Primitives.jsx:204-295 — button palette + sizes ported to Tailwind utilities.
// Token references: --color-accent, --color-accent-strong, --color-accent-press,
// --bg-raised, --bg-hover, --color-ink-700, --fg-1, --fg-2, --color-paper-500,
// --stroke-default (all defined in global.css :root).
const buttonVariants = cva(
	[
		"inline-flex shrink-0 items-center justify-center gap-[7px]",
		"rounded-[var(--radius-sm)] border font-semibold whitespace-nowrap",
		"transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)]",
		"outline-none select-none cursor-pointer",
		// focus-visible ring matching prototype focus pattern
		"focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0",
		// disabled state: ink-700 bg + paper-500 text, no pointer events
		"disabled:cursor-not-allowed disabled:bg-[var(--color-ink-700)] disabled:text-[var(--color-paper-500)] disabled:border-transparent",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0",
	].join(" "),
	{
		variants: {
			variant: {
				// primary — accent bg, white text, hover accent-strong, press accent-press + scale(0.98)
				default: [
					"bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent",
					"hover:not-disabled:bg-[var(--color-accent-strong)]",
					"active:not-disabled:bg-[var(--color-accent-press)] active:not-disabled:scale-[0.98]",
				].join(" "),
				// secondary — bg-raised, fg-1, border stroke-default, hover bg-hover
				secondary: [
					"bg-[var(--bg-raised)] text-[var(--fg-1)] border-[var(--stroke-default)]",
					"hover:not-disabled:bg-[var(--bg-hover)]",
					"active:not-disabled:bg-[var(--color-ink-700)]",
				].join(" "),
				// ghost — transparent, fg-2, no border, hover rgba white 5%
				ghost: [
					"bg-transparent text-[var(--fg-2)] border-transparent",
					"hover:not-disabled:bg-[rgba(255,255,255,0.05)]",
					"active:not-disabled:bg-[var(--bg-hover)]",
				].join(" "),
				// destructive (prototype "danger") — transparent bg, fail text, fail border
				destructive: [
					"bg-transparent text-[var(--color-fail)] border-[rgba(255,107,94,0.28)]",
					"hover:not-disabled:bg-[rgba(255,107,94,0.08)]",
					"active:not-disabled:bg-[rgba(255,107,94,0.14)]",
				].join(" "),
				// keep outline/link for any existing call sites that might use them
				outline: [
					"bg-[var(--bg-raised)] text-[var(--fg-1)] border-[var(--stroke-default)]",
					"hover:not-disabled:bg-[var(--bg-hover)]",
				].join(" "),
				link: "bg-transparent border-transparent text-[var(--color-accent)] underline-offset-4 hover:underline",
			},
			size: {
				// sm: h-7 (28px), px-2.5 (10px), text-xs (12px)
				sm: "h-7 px-2.5 text-xs",
				// default/md: h-[34px], px-3.5 (14px), text-[13px]
				default: "h-[34px] px-3.5 text-[13px]",
				// lg: h-[42px], px-5 (20px), text-[15px]
				lg: "h-[42px] px-5 text-[15px]",
				// icon variants kept for existing usages
				icon: "size-[34px] p-0",
				"icon-sm": "size-7 p-0",
				"icon-lg": "size-[42px] p-0",
				// xs kept for backward compat
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
