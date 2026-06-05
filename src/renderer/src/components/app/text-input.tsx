// Primitives.jsx:298-326 — TextInput (called "Input" in prototype).
// Thin wrapper over ui/input and ui/textarea — preserves the existing props API
// so Stage B consumers can migrate independently.
/** @deprecated migrate to ui/input + ui/textarea (Stage B) */

import { Input } from "@renderer/components/ui/input"
import { Textarea } from "@renderer/components/ui/textarea"
import { cn } from "@renderer/lib/utils"

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

	const monoClass = mono ? "font-mono" : undefined

	if (rows !== undefined) {
		return (
			<Textarea
				value={value}
				placeholder={placeholder}
				rows={rows}
				autoFocus={autoFocus}
				onChange={(e) => onChange(e.target.value)}
				className={cn(monoClass, className)}
			/>
		)
	}

	return (
		<Input
			type="text"
			value={value}
			placeholder={placeholder}
			autoFocus={autoFocus}
			onChange={(e) => onChange(e.target.value)}
			className={cn(monoClass, className)}
		/>
	)
}

export { TextInput }
