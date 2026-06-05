import { useQuery } from "@tanstack/react-query"

export function HomePage(): React.JSX.Element {
	const { data } = useQuery({
		queryKey: ["ping"],
		queryFn: () => window.api.ping("World"),
	})

	return (
		<div className="flex h-full w-full items-center justify-center bg-black text-white">
			<h1 className="text-2xl font-bold">Hello {data || ""}</h1>
		</div>
	)
}
