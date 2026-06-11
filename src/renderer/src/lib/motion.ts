import type { Transition, Variants } from "motion/react"

/* Mirrors --dur-* / --ease-* in global.css — keep both in sync. */
export const durFast = 0.12
export const durBase = 0.2
export const durSlow = 0.36

type Bezier = [number, number, number, number]
export const easeStandard: Bezier = [0.2, 0, 0, 1]
export const easeEmphasized: Bezier = [0.3, 0, 0, 1]

export const tweenBase: Transition = { duration: durBase, ease: easeStandard }
export const tweenEmphasized: Transition = { duration: durSlow, ease: easeEmphasized }
export const tweenExit: Transition = { duration: durFast, ease: easeStandard }

export const fade: Variants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: tweenBase },
	exit: { opacity: 0, transition: tweenExit },
}

export const rise: Variants = {
	hidden: { opacity: 0, y: 10 },
	visible: { opacity: 1, y: 0, transition: tweenEmphasized },
	exit: { opacity: 0, y: 4, transition: tweenExit },
}

/* Pick/ban portrait landing in a slot. */
export const stamp: Variants = {
	hidden: { opacity: 0, scale: 1.12 },
	visible: { opacity: 1, scale: 1, transition: { duration: durBase, ease: easeEmphasized } },
}

/* Notes-grid cards: staggered rise in (custom = index), shrink-fade out. */
export const gridItem: Variants = {
	hidden: { opacity: 0, y: 10 },
	visible: (i: number = 0) => ({
		opacity: 1,
		y: 0,
		transition: { ...tweenEmphasized, delay: Math.min(i * 0.04, 0.24) },
	}),
	exit: { opacity: 0, scale: 0.97, transition: tweenExit },
}

/* Settings chips (mains editor). */
export const chip: Variants = {
	hidden: { opacity: 0, scale: 0.9 },
	visible: { opacity: 1, scale: 1, transition: tweenBase },
	exit: { opacity: 0, scale: 0.9, transition: tweenExit },
}
