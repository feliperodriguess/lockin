// Primitives.jsx:298-326 — TextInput (called "Input" in prototype).
// ink-950 bg, border stroke-default; focus: accent border + glow (same as SearchField).
// mono prop: uses font-mono instead of font-ui. 13px font.
// rows prop: renders <textarea> with vertical resize; else <input> with h-[34px].
// Controlled: value/onChange strings.

import { cn } from "@renderer/lib/utils"
import { useState } from "react"

interface TextInputBaseProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	mono?: boolean
	autoFocus?: boolean
	className?: string
}

interface TextInputFieldProps extends TextInputBaseProps {
	rows?: undefined
}

interface TextInputAreaProps extends TextInputBaseProps {
	rows: number
}

type TextInputProps = TextInputFieldProps | TextInputAreaProps

function TextInput(props: TextInputProps): React.JSX.Element {
	const { value, onChange, placeholder, mono, rows, autoFocus, className } = props
	const [focused, setFocused] = useState(false)

	const baseClass = cn(
		"w-full bg-[var(--color-ink-950)] rounded-[var(--radius-sm)]",
		"border text-[var(--fg-1)] outline-none",
		"text-[13px] leading-none",
		mono ? "font-mono" : "font-[var(--font-ui)]",
		"placeholder:text-[var(--fg-4)]",
		"transition-[border-color,box-shadow] duration-[160ms] ease-[var(--ease-standard)]",
		focused
			? "border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent),0_0_16px_var(--accent-glow)]"
			: "border-[var(--stroke-default)]",
		className,
	)

	const handleFocus = () => setFocused(true)
	const handleBlur = () => setFocused(false)
	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
		onChange(e.target.value)

	if (rows !== undefined) {
		return (
			<textarea
				value={value}
				placeholder={placeholder}
				rows={rows}
				// biome-ignore lint/a11y/noAutofocus: consumer opt-in
				autoFocus={autoFocus}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onChange={handleChange}
				className={cn(baseClass, "px-3 py-[10px] leading-[1.6] resize-y")}
			/>
		)
	}

	return (
		<input
			type="text"
			value={value}
			placeholder={placeholder}
			// biome-ignore lint/a11y/noAutofocus: consumer opt-in
			autoFocus={autoFocus}
			onFocus={handleFocus}
			onBlur={handleBlur}
			onChange={handleChange}
			className={cn(baseClass, "h-[34px] px-3")}
		/>
	)
}

export { TextInput }
