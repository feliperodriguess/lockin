// Primitives.jsx:329-381 — SearchField.

import { Input } from "@renderer/components/ui/input"
import { cn } from "@renderer/lib/utils"
import { Search, X } from "lucide-react"

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
	return (
		<div
			className={cn(
				"relative flex items-center h-[34px]",
				"[&:focus-within_input]:border-accent",
				"[&:focus-within_input]:shadow-[0_0_0_1px_var(--color-accent),0_0_16px_var(--accent-glow)]",
				className,
			)}
		>
			<Search
				size={15}
				strokeWidth={1.75}
				className="absolute left-3 shrink-0 text-paper-300 pointer-events-none z-10"
			/>
			<Input
				type="text"
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
				className="pl-[34px] pr-[30px] h-[34px]"
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="absolute right-2 flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer text-paper-300 hover:text-paper-200 shrink-0"
				>
					<X size={14} strokeWidth={1.75} />
				</button>
			)}
		</div>
	)
}

export { SearchField }
