import { RANKED_QUEUE_ID } from "./lcu-mappers"

/** The two ranked queue actions surfaced in the tray, in menu order. */
export const QUEUE_ACTIONS: { label: string; queueId: number }[] = [
	{ label: "Start ranked queue", queueId: RANKED_QUEUE_ID.SOLO_DUO },
	{ label: "Start flex queue", queueId: RANKED_QUEUE_ID.FLEX },
]

/** Human-readable notification body when a tray queue-start fails. */
export function queueErrorMessage(label: string, error?: string): string {
	if (error) return `${label} failed: ${error}`
	return `${label} failed. Check the League client and try again.`
}
