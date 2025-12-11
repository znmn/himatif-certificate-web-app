import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = { ...process.env, ...loadEnv(mode, process.cwd(), "SERVER_") };
	const allowedHosts =
		env.SERVER_ALLOWED_HOSTS && typeof env.SERVER_ALLOWED_HOSTS === "string"
			? env.SERVER_ALLOWED_HOSTS.split(",")
					.map((h) => h.trim())
					.filter((h) => h.length > 0)
			: [];

	return {
		plugins: [react(), tailwindcss()],
		server: {
			port: 5137,
			host: true,
			strictPort: true,
			allowedHosts,
		},
		preview: {
			port: 5137,
			host: true,
			allowedHosts,
			strictPort: true,
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "src"),
			},
		},
		build: {
			chunkSizeWarningLimit: 500,
			rollupOptions: {
				external: ["fs", "path", "os"],
				output: {
					manualChunks: {
						// React ecosystem
						react: ["react", "react-dom"],
						"react-router-dom": ["react-router-dom"],
						"react-day-picker": ["react-day-picker"],
						"react-resizable-panels": ["react-resizable-panels"],

						// UI Components (Radix UI)
						"radix-ui-navigation": [
							"@radix-ui/react-navigation-menu",
							"@radix-ui/react-menubar",
							"@radix-ui/react-tabs",
						],
						"radix-ui-overlays": [
							"@radix-ui/react-dialog",
							"@radix-ui/react-alert-dialog",
							"@radix-ui/react-popover",
							"@radix-ui/react-hover-card",
							"@radix-ui/react-tooltip",
						],
						"radix-ui-selection": [
							"@radix-ui/react-select",
							"@radix-ui/react-dropdown-menu",
							"@radix-ui/react-context-menu",
						],
						"radix-ui-inputs": [
							"@radix-ui/react-checkbox",
							"@radix-ui/react-radio-group",
							"@radix-ui/react-switch",
							"@radix-ui/react-slider",
							"@radix-ui/react-toggle",
							"@radix-ui/react-toggle-group",
						],
						"radix-ui-layout": [
							"@radix-ui/react-accordion",
							"@radix-ui/react-collapsible",
							"@radix-ui/react-scroll-area",
							"@radix-ui/react-aspect-ratio",
						],

						// Utility libraries
						"ui-utils": [
							"class-variance-authority",
							"clsx",
							"tailwind-merge",
							"@radix-ui/react-slot",
							"@radix-ui/react-label",
							"@radix-ui/react-separator",
							"@radix-ui/react-avatar",
							"@radix-ui/react-progress",
							"next-themes",
							"zod",
						],
						"ui-components": [
							"cmdk",
							"input-otp",
							"vaul",
							"sonner",
							"lucide-react",
							"react-hook-form",
							"@hookform/resolvers",
						],

						// Charts and data visualization
						recharts: ["recharts"],

						// Web3/Blockchain - split into separate chunks
						ethers: ["ethers"],
						wagmi: ["wagmi"],

						// PDF and document processing - split into separate chunks
						"pdf-lib": ["pdf-lib"],
						"pdf-utils": ["qrcode"],

						// Data processing and file handling
						"data-processing": ["jszip", "papaparse"],

						// Query client and state management
						"query-client": ["@tanstack/react-query"],

						// Date utilities
						"date-utils": ["date-fns"],

						// Carousel
						"embla-carousel": ["embla-carousel-react"],
					},
				},
			},
		},
	};
});
