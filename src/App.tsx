import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import {
	Moon,
	Sun,
	PenTool,
	ShieldCheck,
	TestTube,
	Database,
	Cloud,
} from "lucide-react";
import {
	Link,
	NavLink,
	Route,
	BrowserRouter,
	Routes,
	useLocation,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { config } from "@/config";
import Sign from "@/pages/Sign";
import Verify from "@/pages/Verify";

// Lazy load testing pages only when TESTING_ENABLED is true
const Tests = config.TESTING_ENABLED
	? lazy(() => import("@/pages/Tests"))
	: null;
const GenerateTampering = config.TESTING_ENABLED
	? lazy(() => import("@/pages/GenerateTampering"))
	: null;

// Lazy load full onchain pages only when ONLY_HYBRID is false
const SignOnchain = !config.ONLY_HYBRID
	? lazy(() => import("@/pages/full/Sign"))
	: null;
const VerifyOnchain = !config.ONLY_HYBRID
	? lazy(() => import("@/pages/full/Verify"))
	: null;
const TestsOnchain =
	config.TESTING_ENABLED && !config.ONLY_HYBRID
		? lazy(() => import("@/pages/full/Tests"))
		: null;

function App() {
	return (
		<BrowserRouter>
			<div className="min-h-screen bg-background text-foreground">
				<SiteHeader />
				<main className="pb-16 md:pb-0">
					<Routes>
						{/* Hybrid routes (default) */}
						<Route path="/" element={<Sign />} />
						<Route path="/sign" element={<Sign />} />
						<Route path="/verify" element={<Verify />} />
						{config.TESTING_ENABLED && Tests && (
							<Route
								path="/tests"
								element={
									<Suspense fallback={null}>
										<Tests />
									</Suspense>
								}
							/>
						)}
						{config.TESTING_ENABLED && GenerateTampering && (
							<Route
								path="/generate-tampering"
								element={
									<Suspense fallback={null}>
										<GenerateTampering />
									</Suspense>
								}
							/>
						)}
						{/* Full onchain routes */}
						{!config.ONLY_HYBRID && SignOnchain && (
							<>
								<Route
									path="/full"
									element={
										<Suspense fallback={null}>
											<SignOnchain />
										</Suspense>
									}
								/>
								<Route
									path="/full/sign"
									element={
										<Suspense fallback={null}>
											<SignOnchain />
										</Suspense>
									}
								/>
							</>
						)}
						{!config.ONLY_HYBRID && VerifyOnchain && (
							<Route
								path="/full/verify"
								element={
									<Suspense fallback={null}>
										<VerifyOnchain />
									</Suspense>
								}
							/>
						)}
						{!config.ONLY_HYBRID && config.TESTING_ENABLED && TestsOnchain && (
							<Route
								path="/full/tests"
								element={
									<Suspense fallback={null}>
										<TestsOnchain />
									</Suspense>
								}
							/>
						)}
					</Routes>
				</main>
				<MobileBottomNav />
				<Toaster closeButton richColors position="top-right" />
			</div>
		</BrowserRouter>
	);
}

function SiteHeader() {
	const location = useLocation();
	const isOnchainMode = location.pathname.startsWith("/full");

	return (
		<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl supports-backdrop-filter:bg-background/80 border-border/50 shadow-sm">
			<div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-6 px-6 lg:px-8">
				{/* Logo Section */}
				<div className="flex items-center gap-3">
					<Link
						to={isOnchainMode ? "/full" : "/"}
						className="flex h-10 w-10 items-center justify-center rounded-xl"
					>
						<img src="/logo.png" alt="Logo" className="h-full w-full" />
					</Link>
				</div>

				{/* Navigation Section */}
				<nav className="hidden md:flex items-center gap-1">
					{!config.ONLY_HYBRID && isOnchainMode ? (
						<>
							<NavigationLink to="/full/sign">
								<PenTool className="h-4 w-4" />
								Tandatangani
							</NavigationLink>
							<NavigationLink to="/full/verify">
								<ShieldCheck className="h-4 w-4" />
								Verifikasi
							</NavigationLink>
							{config.TESTING_ENABLED && (
								<NavigationLink to="/full/tests">
									<TestTube className="h-4 w-4" />
									Tests
								</NavigationLink>
							)}
						</>
					) : (
						<>
							<NavigationLink to="/sign">
								<PenTool className="h-4 w-4" />
								Tandatangani
							</NavigationLink>
							<NavigationLink to="/verify">
								<ShieldCheck className="h-4 w-4" />
								Verifikasi
							</NavigationLink>
							{config.TESTING_ENABLED && (
								<NavigationLink to="/tests">
									<TestTube className="h-4 w-4" />
									Tests
								</NavigationLink>
							)}
						</>
					)}
				</nav>

				{/* Actions Section */}
				<div className="flex items-center gap-3">
					<ModeSwitch />
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}

function ModeSwitch() {
	const location = useLocation();
	const isOnchainMode = location.pathname.startsWith("/full");

	// Hide mode switch if ONLY_HYBRID is true
	if (config.ONLY_HYBRID) return null;

	return (
		<div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
			<Link
				to="/sign"
				className={cn(
					"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
					!isOnchainMode
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				title="Hybrid Mode - Off-chain signature, on-chain verification"
			>
				<Cloud className="h-3.5 w-3.5" />
				<span className="hidden sm:inline">Hybrid</span>
			</Link>
			<Link
				to="/full/sign"
				className={cn(
					"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
					isOnchainMode
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				title="Full Onchain Mode - All data stored on blockchain"
			>
				<Database className="h-3.5 w-3.5" />
				<span className="hidden sm:inline">Onchain</span>
			</Link>
		</div>
	);
}

function NavigationLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg hover:bg-accent/50",
					isActive
						? "text-foreground font-semibold bg-accent/70 shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)
			}
		>
			{children}
		</NavLink>
	);
}

function MobileBottomNav() {
	const location = useLocation();
	const isOnchainMode = location.pathname.startsWith("/full");

	return (
		<div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 shadow-lg">
			<nav className="flex items-center justify-around px-2 py-2">
				{!config.ONLY_HYBRID && isOnchainMode ? (
					<>
						<BottomNavLink to="/full/sign">
							<PenTool className="h-5 w-5" />
							<span className="text-xs font-medium">Tandatangani</span>
						</BottomNavLink>
						<BottomNavLink to="/full/verify">
							<ShieldCheck className="h-5 w-5" />
							<span className="text-xs font-medium">Verifikasi</span>
						</BottomNavLink>
						{config.TESTING_ENABLED && (
							<BottomNavLink to="/full/tests">
								<TestTube className="h-5 w-5" />
								<span className="text-xs font-medium">Tests</span>
							</BottomNavLink>
						)}
						<Link
							to="/sign"
							className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
						>
							<Cloud className="h-5 w-5" />
							<span className="text-xs font-medium">Hybrid</span>
						</Link>
					</>
				) : (
					<>
						<BottomNavLink to="/sign">
							<PenTool className="h-5 w-5" />
							<span className="text-xs font-medium">Tandatangani</span>
						</BottomNavLink>
						<BottomNavLink to="/verify">
							<ShieldCheck className="h-5 w-5" />
							<span className="text-xs font-medium">Verifikasi</span>
						</BottomNavLink>
						{config.TESTING_ENABLED && (
							<BottomNavLink to="/tests">
								<TestTube className="h-5 w-5" />
								<span className="text-xs font-medium">Tests</span>
							</BottomNavLink>
						)}
						{!config.ONLY_HYBRID && (
							<Link
								to="/full/sign"
								className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
							>
								<Database className="h-5 w-5" />
								<span className="text-xs font-medium">Onchain</span>
							</Link>
						)}
					</>
				)}
			</nav>
		</div>
	);
}

function BottomNavLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200",
					isActive
						? "text-primary bg-primary/10"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50"
				)
			}
		>
			{children}
		</NavLink>
	);
}

const storageKey = "preferred-theme";
type Theme = "light" | "dark";

function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>(() => {
		if (typeof window === "undefined") {
			return "light";
		}
		const stored = window.localStorage.getItem(storageKey);
		if (stored === "light" || stored === "dark") {
			return stored;
		}
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		root.classList.toggle("dark", theme === "dark");
		window.localStorage.setItem(storageKey, theme);
	}, [theme]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (event: MediaQueryListEvent) => {
			setTheme(event.matches ? "dark" : "light");
		};
		media.addEventListener("change", handler);
		return () => media.removeEventListener("change", handler);
	}, []);

	return (
		<Button
			size="icon"
			variant="ghost"
			className="relative h-9 w-9 hover:bg-accent/50 transition-colors"
			onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
			aria-label="Ubah mode gelap"
		>
			<Sun className="size-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute size-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}

export default App;
