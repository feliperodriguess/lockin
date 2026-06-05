import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Link,
	Outlet,
} from "@tanstack/react-router"

import { HomePage } from "./pages/home"
import { NotesPage } from "./pages/notes"
import { SettingsPage } from "./pages/settings"

const rootRoute = createRootRoute({
	component: RootLayout,
})

function RootLayout(): React.JSX.Element {
	return (
		<div className="flex h-screen w-screen flex-col bg-black">
			<nav className="region-drag flex justify-end gap-4 border-b border-white/10 px-4 py-4 text-sm text-white/70">
				<Link to="/" className="[&.active]:text-white" activeOptions={{ exact: true }}>
					Home
				</Link>
				<Link to="/notes" className="[&.active]:text-white">
					Notes
				</Link>
				<Link to="/settings" className="[&.active]:text-white">
					Settings
				</Link>
			</nav>
			<div className="flex-1 overflow-hidden">
				<Outlet />
			</div>
		</div>
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
