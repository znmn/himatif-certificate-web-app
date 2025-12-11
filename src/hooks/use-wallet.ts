import {
	useConnection,
	useConnect,
	useDisconnect,
	useSignTypedData,
	useConnectors,
} from "wagmi";
import { config } from "@/config";
import { VerificationContract } from "@/lib/contract";

export interface SignerInfo {
	address: string;
	name: string;
}

// Hook untuk mengelola koneksi wallet dan penandatanganan sertifikat (mode hybrid)
export function useWallet() {
	const { address, isConnected, chainId } = useConnection();
	const { connect, isPending: isConnecting } = useConnect();
	const { disconnect } = useDisconnect();
	const { signTypedDataAsync, isPending: isSigning } = useSignTypedData();
	const connectors = useConnectors();

	// Memeriksa apakah alamat yang terhubung adalah penandatangan yang terdaftar
	const checkSignerStatus = async (): Promise<{
		isSigner: boolean;
		signerInfo?: SignerInfo;
	}> => {
		if (!address || !isConnected) {
			return { isSigner: false };
		}

		try {
			const verificationContract = VerificationContract.getInstance();
			const contractInfo = await verificationContract.getContractInfo();
			const signerAddress = contractInfo.signerAddress;
			const signerName = contractInfo.signerName;

			const isSigner = signerAddress.toLowerCase() === address.toLowerCase();

			return {
				isSigner,
				signerInfo: {
					address: signerAddress,
					name: signerName,
				},
			};
		} catch (error) {
			console.error("Error checking signer status:", error);
			return { isSigner: false };
		}
	};

	// Menandatangani data sertifikat dengan EIP-712
	const signCertificate = async (
		date: number,
		hash: string,
		number: string,
		recipient: string,
		title: string
	): Promise<string> => {
		if (!address || !isConnected) {
			throw new Error("Wallet not connected");
		}

		try {
			const verificationContract = VerificationContract.getInstance();

			const networkInfo = await verificationContract.getNetworkInfo();

			if (chainId !== networkInfo.chainId) {
				throw new Error(
					`Please switch to the ${networkInfo.name} network to sign documents. Current Chain ID: ${chainId} (Expected ${networkInfo.chainId})`
				);
			}

			const contractInfo = await verificationContract.getContractInfo();
			const appName = contractInfo.appName;
			const version = contractInfo.version;

			const domain = {
				name: appName,
				version: version,
				chainId: chainId || 11155111,
				verifyingContract: config.HYBRID_CONTRACT_ADDRESS,
			};

			const types = {
				Certificate: [
					{ name: "date", type: "uint256" },
					{ name: "hash", type: "bytes32" },
					{ name: "number", type: "string" },
					{ name: "recipient", type: "string" },
					{ name: "title", type: "string" },
				],
			};

			const message = {
				date,
				hash,
				number,
				recipient,
				title,
			};

			const signature = await signTypedDataAsync({
				domain,
				types,
				primaryType: "Certificate",
				message,
			});

			return signature;
		} catch (error) {
			console.error("Error signing certificate:", error);
			throw new Error(
				`Failed to sign certificate: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	};

	return {
		address,
		isConnected,
		chainId,
		isConnecting,
		isSigning,
		connect,
		connectors,
		disconnect,
		checkSignerStatus,
		signCertificate,
	};
}
