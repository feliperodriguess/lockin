#!/usr/bin/env node
/* DEV verification helper — drives the running dev app over CDP (port 9223).
   Usage:
     node scripts/cdp.mjs eval '<js expression>'   // awaits promises, prints JSON result
     node scripts/cdp.mjs shot /tmp/app.png        // PNG screenshot of the renderer
   Requires `pnpm dev` to be running (the CDP port is DEV-only). */
import { writeFileSync } from "node:fs"

const [, , cmd, arg] = process.argv
if (!cmd || !arg) {
	console.error("usage: cdp.mjs eval '<expr>' | cdp.mjs shot <file.png>")
	process.exit(1)
}

const list = await (await fetch("http://127.0.0.1:9223/json/list")).json()
const page = list.find((t) => t.type === "page" && !t.url.startsWith("devtools://"))
if (!page) {
	console.error("no renderer page target; is `pnpm dev` running?")
	process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let nextId = 1
const pending = new Map()

// stale targets (e.g. right after location.reload) can leave the socket in
// limbo — fail loudly instead of hanging the caller
setTimeout(() => {
	console.error("cdp timeout (stale target? retry)")
	process.exit(2)
}, 15_000).unref?.()
ws.onerror = (event) => {
	console.error("cdp socket error:", event.message ?? "unknown")
	process.exit(2)
}

function send(method, params = {}) {
	const id = nextId++
	ws.send(JSON.stringify({ id, method, params }))
	return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

ws.onmessage = (event) => {
	const msg = JSON.parse(event.data)
	if (msg.id && pending.has(msg.id)) {
		const { resolve, reject } = pending.get(msg.id)
		pending.delete(msg.id)
		if (msg.error) reject(new Error(msg.error.message))
		else resolve(msg.result)
	}
}

ws.onopen = async () => {
	try {
		if (cmd === "eval") {
			const res = await send("Runtime.evaluate", {
				expression: arg,
				awaitPromise: true,
				returnByValue: true,
			})
			if (res.exceptionDetails) {
				console.error("threw:", JSON.stringify(res.exceptionDetails))
				process.exitCode = 1
			} else {
				console.log(JSON.stringify(res.result.value ?? res.result, null, 2))
			}
		} else if (cmd === "shot") {
			const res = await send("Page.captureScreenshot", { format: "png" })
			writeFileSync(arg, Buffer.from(res.data, "base64"))
			console.log(`wrote ${arg}`)
		} else {
			console.error(`unknown command: ${cmd}`)
			process.exitCode = 1
		}
	} catch (error) {
		console.error(error.message)
		process.exitCode = 1
	} finally {
		ws.close()
	}
}
