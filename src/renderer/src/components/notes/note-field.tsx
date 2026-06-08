import { cn } from "@renderer/lib/utils"

interface FieldProps {
	label: string
	hint?: string
	req?: boolean
	children: React.ReactNode
}

export function Field({ label, hint, req, children }: FieldProps) {
	return (
		<div className="flex flex-col gap-[7px]">
			<span className="flex items-center gap-[6px] font-mono text-[11px] font-medium leading-none tracking-[0.06em] uppercase text-paper-300">
				{label}
				{req && <span className="text-accent">*</span>}
				{hint && (
					<span
						className={cn(
							"normal-case tracking-normal font-sans text-[10px] font-normal text-paper-400",
						)}
					>
						· {hint}
					</span>
				)}
			</span>
			{children}
		</div>
	)
}
