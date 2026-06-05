interface FieldProps {
	label: string
	hint?: string
	req?: boolean
	children: React.ReactNode
}

export function Field({ label, hint, req, children }: FieldProps) {
	return (
		// Using div so biome's noLabelWithoutControl doesn't fire on dynamic children
		<div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
			<span
				style={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					font: "500 11px/1 var(--font-mono)",
					letterSpacing: "0.06em",
					textTransform: "uppercase",
					color: "var(--fg-3)",
				}}
			>
				{label}
				{req && <span style={{ color: "var(--color-accent)" }}>*</span>}
				{hint && (
					<span
						style={{
							textTransform: "none",
							letterSpacing: 0,
							fontFamily: "var(--font-ui)",
							color: "var(--fg-4)",
							fontWeight: 400,
							fontSize: 10,
						}}
					>
						· {hint}
					</span>
				)}
			</span>
			{children}
		</div>
	)
}
