/**
 * Parser for OP.GG MCP's token-optimized text format.
 *
 * Format:
 *   - Zero or more header lines: `class ClassName: field1,field2,...`
 *   - Exactly one root expression line: `ClassName(arg, arg, Nested(...), [a,b], ...)`
 *
 * Values: "double-quoted strings" | bare numbers | true | false | null | [arrays] | ClassName(...)
 *
 * Decoding is schema-aware: constructor args are zipped against the class's
 * declared field order, so OP.GG reordering or appending fields never silently
 * misaligns our normalizer. Decoded nodes are { __class, ...fields }.
 *
 * Any failure returns null (callers treat that as "no build").
 */

export type OpggNode = { __class: string; [field: string]: unknown }
export type OpggValue = string | number | boolean | null | OpggValue[] | OpggNode

type Schema = Map<string, string[]>

/* ----------------------------------------------------------------- header */

const CLASS_LINE = /^class\s+([A-Za-z_]\w*)\s*:\s*(.*)$/

function parseSchema(lines: string[]): { schema: Schema; rest: string } {
	const schema: Schema = new Map()
	let i = 0
	for (; i < lines.length; i++) {
		const line = lines[i]?.trim() ?? ""
		if (line === "") continue
		const match = CLASS_LINE.exec(line)
		if (!match) break // first non-class, non-blank line begins the root expression
		const [, name, fieldsRaw] = match
		const fields = fieldsRaw
			.split(",")
			.map((f) => f.trim())
			.filter((f) => f.length > 0)
		schema.set(name as string, fields)
	}
	const rest = lines.slice(i).join("\n").trim()
	return { schema, rest }
}

/* ---------------------------------------------------------------- scanner */

class Scanner {
	private pos = 0
	constructor(
		private readonly src: string,
		private readonly schema: Schema,
	) {}

	parseRoot(): OpggValue {
		this.skipWhitespace()
		const value = this.parseValue()
		this.skipWhitespace()
		if (this.pos !== this.src.length) {
			throw new Error(`trailing input at ${this.pos}`)
		}
		return value
	}

	private skipWhitespace(): void {
		while (this.pos < this.src.length && /\s/.test(this.src[this.pos] as string)) this.pos++
	}

	private peek(): string {
		return this.src[this.pos] ?? ""
	}

	private parseValue(): OpggValue {
		this.skipWhitespace()
		const ch = this.peek()
		if (ch === '"') return this.parseString()
		if (ch === "[") return this.parseArray()
		if (/[A-Za-z_]/.test(ch)) return this.parseIdentOrKeyword()
		if (ch === "-" || /[0-9.]/.test(ch)) return this.parseNumber()
		throw new Error(`unexpected char '${ch}' at ${this.pos}`)
	}

	private parseString(): string {
		this.pos++ // opening quote
		let out = ""
		while (this.pos < this.src.length) {
			const ch = this.src[this.pos++] as string
			if (ch === "\\") {
				const next = this.src[this.pos++] as string
				out += next === "n" ? "\n" : next === "t" ? "\t" : next
				continue
			}
			if (ch === '"') return out
			out += ch
		}
		throw new Error("unterminated string")
	}

	private parseNumber(): number {
		const start = this.pos
		if (this.peek() === "-") this.pos++
		while (this.pos < this.src.length && /[0-9.eE+-]/.test(this.src[this.pos] as string)) this.pos++
		const raw = this.src.slice(start, this.pos)
		const num = Number(raw)
		if (!Number.isFinite(num)) throw new Error(`bad number '${raw}'`)
		return num
	}

	private parseArray(): OpggValue[] {
		this.pos++ // [
		const out: OpggValue[] = []
		this.skipWhitespace()
		if (this.peek() === "]") {
			this.pos++
			return out
		}
		for (;;) {
			out.push(this.parseValue())
			this.skipWhitespace()
			const ch = this.peek()
			if (ch === ",") {
				this.pos++
				continue
			}
			if (ch === "]") {
				this.pos++
				return out
			}
			throw new Error(`expected ',' or ']' at ${this.pos}`)
		}
	}

	private parseIdentOrKeyword(): OpggValue {
		const start = this.pos
		while (this.pos < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.pos] as string)) {
			this.pos++
		}
		const ident = this.src.slice(start, this.pos)
		if (ident === "true") return true
		if (ident === "false") return false
		if (ident === "null") return null
		this.skipWhitespace()
		if (this.peek() !== "(") throw new Error(`expected '(' after class '${ident}'`)
		return this.parseConstructor(ident)
	}

	private parseConstructor(name: string): OpggNode {
		this.pos++ // (
		const args: OpggValue[] = []
		this.skipWhitespace()
		if (this.peek() === ")") {
			this.pos++
		} else {
			for (;;) {
				args.push(this.parseValue())
				this.skipWhitespace()
				const ch = this.peek()
				if (ch === ",") {
					this.pos++
					continue
				}
				if (ch === ")") {
					this.pos++
					break
				}
				throw new Error(`expected ',' or ')' in ${name} at ${this.pos}`)
			}
		}
		const fields = this.schema.get(name) ?? []
		const node: OpggNode = { __class: name }
		for (let i = 0; i < fields.length && i < args.length; i++) {
			node[fields[i] as string] = args[i]
		}
		return node
	}
}

export function parseOpggText(text: string): OpggValue | null {
	try {
		if (!text || text.trim() === "") return null
		const { schema, rest } = parseSchema(text.split("\n"))
		if (rest === "") return null
		return new Scanner(rest, schema).parseRoot()
	} catch {
		return null
	}
}
