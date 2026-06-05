import { useAcceptReadyCheck, useDeclineReadyCheck, useSettings } from "@renderer/hooks/use-data"
import { useReadyCheck } from "@renderer/hooks/use-lcu"
import { Check, X } from "lucide-react"

import { CountdownRing } from "../game/countdown-ring"
import { Button } from "../ui/button"

const READY_CHECK_TOTAL = 12

export function ReadyCheckScreen(): React.JSX.Element | null {
	const readyCheck = useReadyCheck()
	const { data: settings } = useSettings()
	const acceptMutation = useAcceptReadyCheck()
	const declineMutation = useDeclineReadyCheck()

	// race-safe vanish (PRD §6.4)
	if (readyCheck == null) return null

	const left = Math.max(0, READY_CHECK_TOTAL - readyCheck.timer)
	const mutationPending = acceptMutation.isPending || declineMutation.isPending

	// --- Accepted ---
	if (readyCheck.playerResponse === "Accepted") {
		return (
			<section
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 22,
				}}
			>
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="accent"
					value={<Check size={52} strokeWidth={2.5} style={{ color: "var(--color-accent)" }} />}
					label="Accepted"
				/>
				<div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
					<h1 style={{ font: "400 22px/1.3 var(--font-display)", color: "var(--fg-1)", margin: 0 }}>
						Match accepted
					</h1>
					<p style={{ font: "400 13px/1.4 var(--font-ui)", color: "var(--fg-3)", margin: 0 }}>
						{settings?.autoAccept
							? "Auto-accept handled it — sit tight for champ select."
							: "Locked in. Loading champ select…"}
					</p>
				</div>
			</section>
		)
	}

	// --- Declined ---
	if (readyCheck.playerResponse === "Declined") {
		return (
			<section
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 20,
				}}
			>
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="warn"
					value={<X size={48} strokeWidth={2.5} style={{ color: "var(--color-warn)" }} />}
					label="Declined"
				/>
				<p style={{ font: "400 13px/1.4 var(--font-ui)", color: "var(--fg-3)", margin: 0 }}>
					Back to the queue.
				</p>
			</section>
		)
	}

	// --- Missed (state === "Invalid" and playerResponse === "None") ---
	if (readyCheck.state === "Invalid") {
		return (
			<section
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 20,
				}}
			>
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="warn"
					value={<X size={48} strokeWidth={2.5} style={{ color: "var(--color-warn)" }} />}
					label="Missed"
				/>
				<p style={{ font: "400 13px/1.4 var(--font-ui)", color: "var(--fg-3)", margin: 0 }}>
					Back to the queue.
				</p>
			</section>
		)
	}

	// --- Waiting ---
	const autoAccept = settings?.autoAccept ?? false

	return (
		<section
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 26,
			}}
		>
			<CountdownRing
				size={188}
				stroke={9}
				progress={left / READY_CHECK_TOTAL}
				tone={left <= 3 ? "warn" : "accent"}
				value={left}
				label="seconds"
				pulsing={left <= 3}
			/>
			<div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
				<h1
					style={{
						font: "600 20px/1.1 var(--font-ui)",
						color: "var(--fg-1)",
						margin: 0,
					}}
				>
					{autoAccept ? "Auto-accepting…" : "Match found — accept?"}
				</h1>
				<p
					style={{
						font: "400 12.5px/1 var(--font-mono)",
						color: "var(--fg-4)",
						margin: 0,
					}}
				>
					{autoAccept ? `Firing in ${left}s · cancel to take over` : "Your move"}
				</p>
			</div>
			<div style={{ display: "flex", gap: 12 }}>
				<Button
					size="lg"
					disabled={mutationPending}
					onClick={() => acceptMutation.mutate()}
					style={{ minWidth: 132 }}
				>
					<Check size={16} />
					Accept
				</Button>
				<Button
					variant="destructive"
					size="lg"
					disabled={mutationPending}
					onClick={() => declineMutation.mutate()}
					style={{ minWidth: 132 }}
				>
					<X size={16} />
					Decline
				</Button>
			</div>
		</section>
	)
}
