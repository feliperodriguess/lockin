import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router"

import { Sidebar } from "./components/app/sidebar"
import { WindowFrame } from "./components/app/window-frame"
import { useLcuStatus, usePhase } from "./hooks/use-lcu"
import { HomePage } from "./pages/home"
import { NotesPage } from "./pages/notes"
import { SettingsPage } from "./pages/settings"

const rootRoute = createRootRoute({
	component: RootLayout,
})

function RootLayout(): React.JSX.Element {
	const { connected } = useLcuStatus()
	const phase = usePhase()
	return (
		<WindowFrame connected={connected} phase={phase}>
			<div className="flex min-h-0 flex-1">
				<Sidebar connected={connected} phase={phase} />
				<main className="relative min-w-0 flex-1 overflow-hidden bg-ink-950">
					<div className="ccp-screen absolute inset-0 p-4">
						<Outlet />
					</div>
				</main>
			</div>
			{/* dev switcher mounts here (Task 8) */}
		</WindowFrame>
	)
}

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomePage,
})

const notesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/notes",
	component: NotesPage,
})

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: SettingsPage,
})

const routeTree = rootRoute.addChildren([homeRoute, notesRoute, settingsRoute])

const history = createMemoryHistory({
	initialEntries: ["/"],
})

export const router = createRouter({
	routeTree,
	history,
})

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}
