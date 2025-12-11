import { createConfig, http } from "wagmi";
import { mainnet, sepolia, base, optimism, bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Konfigurasi wagmi untuk koneksi wallet
export const config = createConfig({
	chains: [mainnet, sepolia, base, optimism, bsc],
	connectors: [injected()],
	transports: {
		[mainnet.id]: http(),
		[sepolia.id]: http(),
		[base.id]: http(),
		[optimism.id]: http(),
		[bsc.id]: http(),
	},
});

declare module "wagmi" {
	interface Register {
		config: typeof config;
	}
}
