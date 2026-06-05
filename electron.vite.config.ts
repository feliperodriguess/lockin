import { resolve } from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import tsconfigPathsPlugin from "vite-tsconfig-paths"

const tsconfigPaths = tsconfigPathsPlugin({
	projects: [resolve("tsconfig.json")],
})

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin({ exclude: ["electron-store"] }), tsconfigPaths],
	},
	preload: {
		plugins: [tsconfigPaths],
	},
	renderer: {
		define: {
			"process.platform": JSON.stringify(process.platform),
		},
		resolve: {
			alias: {
				"@": resolve("src"),
				"@renderer": resolve("src/renderer/src"),
			},
		},
		plugins: [react(), tailwindcss(), tsconfigPaths],
	},
})
