import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import { LcuProvider } from "./providers/lcu-provider"
import { router } from "./routes"

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false, refetchOnWindowFocus: false },
	},
})

function App(): React.JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<LcuProvider>
				<RouterProvider router={router} />
			</LcuProvider>
		</QueryClientProvider>
	)
}

export default App
