/** The two ranked queue actions surfaced in the tray, in menu order. */
export const QUEUE_ACTIONS: { label: string; queueId: number }[] = [
	{ label: "Start ranked queue", queueId: 420 },
	{ label: "Start flex queue", queueId: 440 },
]

/** Human-readable notification body when a tray queue-start fails. */
export function queueErrorMessage(label: string, error?: string): string {
	if (error) return `${label} failed: ${error}`
	return `${label} failed. Check the League client and try again.`
}
