import { cn } from "@renderer/lib/utils"

interface ConnectionIndicatorProps {
	connected: boolean
	compact?: boolean
}

export function ConnectionIndicator({
	connected,
	compact = false,
}: ConnectionIndicatorProps): React.JSX.Element {
	return (
		<span className="inline-flex items-center gap-[7px]">
			<span className="relative w-2 h-2 shrink-0">
				<span
					className={cn("absolute inset-0 rounded-full", connected ? "bg-online" : "bg-paper-400")}
				/>
				{connected && <span className="ccp-ping absolute inset-0 rounded-full bg-online" />}
			</span>
			{!compact && (
				<p
					className={cn(
						"font-mono text-[11px] font-medium leading-none tracking-[0.02em] whitespace-nowrap",
						connected ? "text-paper-200" : "text-paper-300",
					)}
				>
					{connected ? "Client Connected" : "Client Not Detected"}
				</p>
			)}
		</span>
	)
}
