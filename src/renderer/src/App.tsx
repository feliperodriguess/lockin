import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"

// import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"

// import { routeTree } from "./routeTree.gen"

// const memoryHistory = createMemoryHistory({
// 	initialEntries: ["/"],
// })

// const router = createRouter({
// 	routeTree,
// 	history: memoryHistory,
// })

// declare module "@tanstack/react-router" {
// 	interface Register {
// 		router: typeof router
// 	}
// }

const queryClient = new QueryClient()

function Home(): React.JSX.Element {
	const { data } = useQuery({
		queryKey: ["ping"],
		queryFn: () => window.api.ping("World"),
	})

	return (
		<div className="flex h-screen w-screen items-center justify-center bg-black text-white">
			<h1 className="text-2xl font-bold">Hello {data || ""}</h1>
		</div>
	)
}

function App(): React.JSX.Element {
	return (
		<>
			{/* <RouterProvider router={router} /> */}
			<QueryClientProvider client={queryClient}>
				<Home />
			</QueryClientProvider>
		</>
	)
}

export default App
