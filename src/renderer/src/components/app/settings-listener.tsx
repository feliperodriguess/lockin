import { api } from "@renderer/api"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

export function SettingsListener(): null {
	const queryClient = useQueryClient()
	useEffect(() => {
		return api.onSettingsChanged((settings) => {
			queryClient.setQueryData(["settings"], settings)
		})
	}, [queryClient])
	return null
}
