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
							? "Auto-accept handled it. Champ select is next."
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
					value={<X size={48} strokeWidth={2.5} className="text-warn" />}
					label="Declined"
				/>
				<p className="m-0 text-[13px] leading-[1.4] text-paper-300">
					Back to the lobby. Queue again when you're ready.
				</p>
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
					value={<X size={48} strokeWidth={2.5} className="text-warn" />}
					label="Missed"
				/>
				<p className="m-0 text-[13px] leading-[1.4] text-paper-300">
					Back to the lobby. Queue again when you're ready.
				</p>
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
					{autoAccept ? "Auto-accepting" : "Match found. Accept?"}
				</h1>
				<p className="m-0 font-mono text-[12.5px] leading-none text-paper-400">
					{autoAccept ? `Accepting in ${left}s · hit Decline to stop it` : "Your move"}
				</p>
			</div>
			<div className="flex gap-3">
				<Button
					size="lg"
					disabled={mutationPending}
					onClick={() => acceptMutation.mutate()}
					className="min-w-[132px]"
				>
					<Check size={16} />
					Accept
				</Button>
				<Button
					variant="destructive"
					size="lg"
					disabled={mutationPending}
					onClick={() => declineMutation.mutate()}
					className="min-w-[132px]"
				>
					<X size={16} />
					Decline
				</Button>
			</div>
		</section>
	)
}
