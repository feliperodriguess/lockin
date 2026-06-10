import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		include: ["src/shared/lib/**/*.test.ts", "src/main/**/*.test.ts"],
	},
})
