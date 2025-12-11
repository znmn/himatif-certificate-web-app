import { ethers } from "ethers";
import { config } from "@/config";

export interface VerificationResult {
	isValid: boolean;
	recoveredSigner: string;
	signerNameAtTime: string;
}

export interface ContractInfo {
	appName: string;
	version: string;
	signerAddress: string;
	signerName: string;
}

export interface NetworkInfo {
	chainId: number;
	name: string;
}

// Kelas untuk berinteraksi dengan kontrak verifikasi hybrid (EIP-712)
export class VerificationContract {
	private static instance: VerificationContract;
	private provider: ethers.JsonRpcProvider;
	private contract: ethers.Contract;
	private networkInfoCache: NetworkInfo | null = null;
	private contractInfoCache: ContractInfo | null = null;

	private constructor(rpcUrl?: string) {
		this.provider = new ethers.JsonRpcProvider(rpcUrl || config.RPC_URL);
		this.contract = new ethers.Contract(
			config.HYBRID_CONTRACT_ADDRESS,
			config.HYBRID_VERIFICATION_ABI,
			this.provider
		);
	}

	// Mendapatkan instance singleton dari kontrak
	public static getInstance(rpcUrl?: string): VerificationContract {
		if (!VerificationContract.instance) {
			VerificationContract.instance = new VerificationContract(rpcUrl);
		}
		return VerificationContract.instance;
	}

	// Mengambil informasi kontrak (nama aplikasi, versi, alamat penandatangan, nama penandatangan)
	async getContractInfo(): Promise<ContractInfo> {
		if (this.contractInfoCache) {
			return this.contractInfoCache;
		}

		try {
			const [appName, version, signerAddress, signerName] = await Promise.all([
				this.contract.appName(),
				this.contract.version(),
				this.contract.signerAddress(),
				this.contract.signerName(),
			]);

			this.contractInfoCache = {
				appName,
				version,
				signerAddress,
				signerName,
			};

			return this.contractInfoCache;
		} catch (error) {
			console.error("Error fetching contract info:", error);
			throw new Error(
				`Failed to fetch contract info: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	// Mengambil informasi jaringan (chainId, nama)
	async getNetworkInfo(): Promise<NetworkInfo> {
		if (this.networkInfoCache) {
			return this.networkInfoCache;
		}

		try {
			const network = await this.provider.getNetwork();
			this.networkInfoCache = {
				chainId: Number(network.chainId),
				name: network.name,
			};
			return this.networkInfoCache;
		} catch (error) {
			console.error("Error fetching network info:", error);
			throw new Error(
				`Failed to fetch network info: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	// Memverifikasi sertifikat dengan tanda tangan EIP-712
	async verifyCertificate(
		date: number,
		hash: string,
		number: string,
		recipient: string,
		title: string,
		signature: string
	): Promise<VerificationResult> {
		try {
			if (!hash.startsWith("0x") || hash.length !== 66) {
				throw new Error(
					"Invalid document hash format. Must be 32 bytes with 0x prefix (66 characters total)"
				);
			}

			if (!signature.startsWith("0x") || signature.length !== 132) {
				throw new Error("Invalid signature format");
			}

			const [isValid, recoveredSigner, signerNameAtTime] =
				await this.contract.verifyCertificate(
					date,
					hash,
					number,
					recipient,
					title,
					signature
				);

			return {
				isValid,
				recoveredSigner,
				signerNameAtTime,
			};
		} catch (error) {
			console.error("Error verifying certificate:", error);
			throw new Error(
				`Failed to verify certificate: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}
}
