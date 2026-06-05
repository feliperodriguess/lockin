// Primitives.jsx:329-381 — SearchField.
// 34px height, ink-950 bg, border stroke-default (focus: accent + glow).
// Search icon 15px fg-3 on left. Clear X button when value is non-empty.
// Controlled: value/onChange strings. Focus ring via border + boxShadow.

import { cn } from "@renderer/lib/utils"
import { Search, X } from "lucide-react"
import { useState } from "react"

interface SearchFieldProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	className?: string
}

function SearchField({
	value,
	onChange,
	placeholder = "Search",
	className,
}: SearchFieldProps): React.JSX.Element {
	const [focused, setFocused] = useState(false)

	return (
		<div
			className={cn(
				"flex items-center gap-2 h-[34px] px-3",
				"bg-[var(--color-ink-950)] rounded-[var(--radius-sm)]",
				"border transition-[border-color,box-shadow] duration-[160ms] ease-[var(--ease-standard)]",
				focused
					? "border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent),0_0_16px_var(--accent-glow)]"
					: "border-[var(--stroke-default)]",
				className,
			)}
		>
			<Search
				size={15}
				strokeWidth={1.75}
				className="shrink-0 text-[var(--fg-3)] pointer-events-none"
			/>
			<input
				type="text"
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				className={cn(
					"flex-1 bg-transparent border-0 outline-none",
					"text-[var(--fg-1)] placeholder:text-[var(--fg-4)]",
					"text-[13px] font-normal leading-none",
				)}
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer text-[var(--fg-3)] hover:text-[var(--fg-2)] shrink-0"
				>
					<X size={14} strokeWidth={1.75} />
				</button>
			)}
		</div>
	)
}

export { SearchField }
