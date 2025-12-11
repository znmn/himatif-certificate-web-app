import { ethers } from "ethers";
import { config } from "@/config";

export interface OnchainVerificationResult {
	isValid: boolean;
	date: number;
	number: string;
	recipient: string;
	title: string;
	signer: string;
	signerNameAtTime: string;
}

export interface OnchainContractInfo {
	appName: string;
	version: string;
	signerAddress: string;
	signerName: string;
}

export interface NetworkInfo {
	chainId: number;
	name: string;
}

export interface SignCertificateResult {
	txHash: string;
	gasUsed: bigint;
	effectiveGasPrice: bigint;
	totalFee: bigint;
	totalFeeETH: string;
	blockNumber: number;
}

export interface SignCertificateSplitResult {
	txHash: string;
	txSentTime: number;
	gasUsed: bigint;
	effectiveGasPrice: bigint;
	totalFee: bigint;
	totalFeeETH: string;
	blockNumber: number;
	confirmedTime: number;
}

// Kelas untuk berinteraksi dengan kontrak verifikasi full onchain
export class OnchainVerificationContract {
	private static instance: OnchainVerificationContract;
	private provider: ethers.JsonRpcProvider;
	private contract: ethers.Contract;
	private networkInfoCache: NetworkInfo | null = null;
	private contractInfoCache: OnchainContractInfo | null = null;

	private constructor(rpcUrl?: string) {
		this.provider = new ethers.JsonRpcProvider(rpcUrl || config.RPC_URL);
		this.contract = new ethers.Contract(
			config.FULL_CONTRACT_ADDRESS,
			config.FULL_VERIFICATION_ABI,
			this.provider
		);
	}

	// Mendapatkan instance singleton dari kontrak
	public static getInstance(rpcUrl?: string): OnchainVerificationContract {
		if (!OnchainVerificationContract.instance) {
			OnchainVerificationContract.instance = new OnchainVerificationContract(
				rpcUrl
			);
		}
		return OnchainVerificationContract.instance;
	}

	// Mereset instance singleton
	public static resetInstance(): void {
		OnchainVerificationContract.instance =
			null as unknown as OnchainVerificationContract;
	}

	// Mendapatkan provider
	getProvider(): ethers.JsonRpcProvider {
		return this.provider;
	}

	// Mengambil informasi kontrak
	async getContractInfo(): Promise<OnchainContractInfo> {
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

	// Mengambil informasi jaringan
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

	// Menandatangani sertifikat on-chain (memerlukan wallet penandatangan)
	async signCertificate(
		signer: ethers.Signer,
		date: number,
		hash: string,
		number: string,
		recipient: string,
		title: string
	): Promise<SignCertificateResult> {
		try {
			if (!hash.startsWith("0x") || hash.length !== 66) {
				throw new Error(
					"Invalid document hash format. Must be 32 bytes with 0x prefix (66 characters total)"
				);
			}

			const contractWithSigner = this.contract.connect(
				signer
			) as ethers.Contract;
			const tx = await contractWithSigner.signCertificate(
				date,
				hash,
				number,
				recipient,
				title
			);
			const receipt = await tx.wait();

			const gasUsed = BigInt(receipt.gasUsed);
			const effectiveGasPrice = BigInt(receipt.gasPrice || 0);
			const totalFee = gasUsed * effectiveGasPrice;

			return {
				txHash: receipt.hash,
				gasUsed,
				effectiveGasPrice,
				totalFee,
				totalFeeETH: ethers.formatEther(totalFee),
				blockNumber: Number(receipt.blockNumber),
			};
		} catch (error) {
			console.error("Error signing certificate on-chain:", error);
			throw new Error(
				`Failed to sign certificate: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	// Menandatangani sertifikat on-chain dengan metrik waktu terpisah
	async signCertificateSplit(
		signer: ethers.Signer,
		date: number,
		hash: string,
		number: string,
		recipient: string,
		title: string
	): Promise<SignCertificateSplitResult> {
		try {
			if (!hash.startsWith("0x") || hash.length !== 66) {
				throw new Error(
					"Invalid document hash format. Must be 32 bytes with 0x prefix (66 characters total)"
				);
			}

			const contractWithSigner = this.contract.connect(
				signer
			) as ethers.Contract;

			const tx = await contractWithSigner.signCertificate(
				date,
				hash,
				number,
				recipient,
				title
			);
			const txSentTime = performance.now();
			const txHash = tx.hash;

			const receipt = await tx.wait();
			const confirmedTime = performance.now();

			const gasUsed = BigInt(receipt.gasUsed);
			const effectiveGasPrice = BigInt(receipt.gasPrice || 0);
			const totalFee = gasUsed * effectiveGasPrice;

			return {
				txHash,
				txSentTime,
				gasUsed,
				effectiveGasPrice,
				totalFee,
				totalFeeETH: ethers.formatEther(totalFee),
				blockNumber: Number(receipt.blockNumber),
				confirmedTime,
			};
		} catch (error) {
			console.error("Error signing certificate on-chain:", error);
			throw new Error(
				`Failed to sign certificate: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	// Memverifikasi sertifikat berdasarkan hash (fungsi view - tanpa biaya gas)
	async verifyCertificate(hash: string): Promise<OnchainVerificationResult> {
		try {
			if (!hash.startsWith("0x") || hash.length !== 66) {
				throw new Error(
					"Invalid document hash format. Must be 32 bytes with 0x prefix (66 characters total)"
				);
			}

			const [
				isValid,
				date,
				number,
				recipient,
				title,
				signer,
				signerNameAtTime,
			] = await this.contract.verifyCertificate(hash);

			return {
				isValid,
				date: Number(date),
				number,
				recipient,
				title,
				signer,
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

	// Memeriksa apakah sertifikat ada
	async certificateExists(hash: string): Promise<boolean> {
		try {
			if (!hash.startsWith("0x") || hash.length !== 66) {
				throw new Error("Invalid document hash format");
			}
			return await this.contract.certificateExists(hash);
		} catch (error) {
			console.error("Error checking certificate existence:", error);
			throw new Error(
				`Failed to check certificate: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	// Mendapatkan jumlah total sertifikat
	async getCertificateCount(): Promise<number> {
		try {
			const count = await this.contract.getCertificateCount();
			return Number(count);
		} catch (error) {
			console.error("Error getting certificate count:", error);
			throw new Error(
				`Failed to get certificate count: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}
}
