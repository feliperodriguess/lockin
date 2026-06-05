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
			<section className="flex h-full flex-col items-center justify-center gap-[22px]">
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="accent"
					value={<Check size={52} strokeWidth={2.5} className="text-accent" />}
					label="Accepted"
				/>
				<div className="flex flex-col items-center gap-[6px]">
					<h1 className="m-0 font-display text-[22px] font-normal leading-[1.3] text-paper-100">
						Match accepted
					</h1>
					<p className="m-0 text-[13px] leading-[1.4] text-paper-300">
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
			<section className="flex h-full flex-col items-center justify-center gap-[20px]">
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="warn"
					value={<X size={48} strokeWidth={2.5} className="text-[var(--color-warn)]" />}
					label="Declined"
				/>
				<p className="m-0 text-[13px] leading-[1.4] text-paper-300">Back to the queue.</p>
			</section>
		)
	}

	// --- Missed (state === "Invalid" and playerResponse === "None") ---
	if (readyCheck.state === "Invalid") {
		return (
			<section className="flex h-full flex-col items-center justify-center gap-[20px]">
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="warn"
					value={<X size={48} strokeWidth={2.5} className="text-[var(--color-warn)]" />}
					label="Missed"
				/>
				<p className="m-0 text-[13px] leading-[1.4] text-paper-300">Back to the queue.</p>
			</section>
		)
	}

	// --- Waiting ---
	const autoAccept = settings?.autoAccept ?? false

	return (
		<section className="flex h-full flex-col items-center justify-center gap-[26px]">
			<CountdownRing
				size={188}
				stroke={9}
				progress={left / READY_CHECK_TOTAL}
				tone={left <= 3 ? "warn" : "accent"}
				value={left}
				label="seconds"
				pulsing={left <= 3}
			/>
			<div className="flex flex-col items-center gap-[5px]">
				<h1 className="m-0 text-[20px] font-semibold leading-[1.1] text-paper-100">
					{autoAccept ? "Auto-accepting…" : "Match found — accept?"}
				</h1>
				<p className="m-0 font-mono text-[12.5px] leading-none text-paper-400">
					{autoAccept ? `Firing in ${left}s · cancel to take over` : "Your move"}
				</p>
			</div>
			<div className="flex gap-3">
				<Button
					size="lg"
					disabled={mutationPending}
					onClick={() => acceptMutation.mutate()}
					// dynamic: minWidth enforces a balanced button pair at fixed widths
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
					// dynamic: minWidth enforces a balanced button pair at fixed widths
					style={{ minWidth: 132 }}
				>
					<X size={16} />
					Decline
				</Button>
			</div>
		</section>
	)
}
