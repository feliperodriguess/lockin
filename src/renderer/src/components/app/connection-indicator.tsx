/* ConnectionIndicator — ported from champ-art.jsx:510-545
   ONLINE_GREEN = #3fd07a, ccp-ping pulse animation */

interface ConnectionIndicatorProps {
	connected: boolean
	compact?: boolean
}

export function ConnectionIndicator({
	connected,
	compact = false,
}: ConnectionIndicatorProps): React.JSX.Element {
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
			<span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
				<span
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: 999,
						background: connected ? "#3fd07a" : "var(--fg-4)",
					}}
				/>
				{connected && (
					<span
						className="ccp-ping"
						style={{
							position: "absolute",
							inset: 0,
							borderRadius: 999,
							background: "#3fd07a",
						}}
					/>
				)}
			</span>
			{!compact && (
				<span
					style={{
						font: "500 11px/1 var(--font-mono)",
						color: connected ? "var(--fg-2)" : "var(--fg-3)",
						letterSpacing: "0.02em",
						whiteSpace: "nowrap",
					}}
				>
					{connected ? "Client Connected" : "Client Not Detected"}
				</span>
			)}
		</span>
	)
}
