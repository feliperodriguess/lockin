import { describe, expect, it } from "vitest"

import { QUEUE_ACTIONS, queueErrorMessage } from "./tray-queues"

describe("QUEUE_ACTIONS", () => {
	it("exposes ranked solo (420) and flex (440) in order", () => {
		expect(QUEUE_ACTIONS.map((q) => q.queueId)).toEqual([420, 440])
	})

	it("labels each action for the menu", () => {
		expect(QUEUE_ACTIONS.map((q) => q.label)).toEqual(["Start ranked queue", "Start flex queue"])
	})
})

describe("queueErrorMessage", () => {
	it("returns the provider error when present", () => {
		expect(queueErrorMessage("Start ranked queue", "Lobby busy")).toBe(
			"Start ranked queue failed: Lobby busy",
		)
	})

	it("falls back to a generic message when no error string is given", () => {
		expect(queueErrorMessage("Start flex queue")).toBe(
			"Start flex queue failed. Check the League client and try again.",
		)
	})
})
