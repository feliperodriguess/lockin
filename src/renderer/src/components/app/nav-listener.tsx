import { api } from "@renderer/api"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

/** Listens for tray-driven `nav:go` pushes and routes the renderer to them. */
export function NavListener(): null {
	const router = useRouter()
	useEffect(() => {
		return api.onNav(({ to, search }) => {
			void router.navigate({ to, search: search ?? {} })
		})
	}, [router])
	return null
}
