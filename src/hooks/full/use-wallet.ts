import {
	useConnection,
	useConnect,
	useDisconnect,
	useConnectors,
	useWriteContract,
	useWaitForTransactionReceipt,
} from "wagmi";
import { config } from "@/config";
import { OnchainVerificationContract } from "@/lib/full/contract";
import { useState, useCallback } from "react";

export interface SignerInfo {
	address: string;
	name: string;
}

// Hook untuk mengelola koneksi wallet dan penandatanganan sertifikat on-chain (mode full onchain)
export function useOnchainWallet() {
	const { address, isConnected, chainId } = useConnection();
	const { connect, isPending: isConnecting } = useConnect();
	const { disconnect } = useDisconnect();
	const connectors = useConnectors();
	const { writeContractAsync, isPending: isWriting } = useWriteContract();
	const [pendingTxHash, setPendingTxHash] = useState<
		`0x${string}` | undefined
	>();

	const { isLoading: isWaitingTx } = useWaitForTransactionReceipt({
		hash: pendingTxHash,
	});

	// Memeriksa apakah alamat yang terhubung adalah penandatangan yang terdaftar
	const checkSignerStatus = async (): Promise<{
		isSigner: boolean;
		signerInfo?: SignerInfo;
	}> => {
		if (!address || !isConnected) {
			return { isSigner: false };
		}

		try {
			const contract = OnchainVerificationContract.getInstance();
			const contractInfo = await contract.getContractInfo();
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

	// Menandatangani sertifikat on-chain menggunakan wagmi writeContract
	const signCertificateOnchain = useCallback(
		async (
			date: number,
			hash: string,
			number: string,
			recipient: string,
			title: string
		): Promise<{
			txHash: string;
			gasUsed: bigint;
			effectiveGasPrice: bigint;
			totalFee: bigint;
			totalFeeETH: string;
		}> => {
			if (!address || !isConnected) {
				throw new Error("Wallet not connected");
			}

			try {
				const contract = OnchainVerificationContract.getInstance();
				const networkInfo = await contract.getNetworkInfo();

				if (chainId !== networkInfo.chainId) {
					throw new Error(
						`Please switch to the ${networkInfo.name} network. Current Chain ID: ${chainId} (Expected ${networkInfo.chainId})`
					);
				}

				const txHash = await writeContractAsync({
					address: config.FULL_CONTRACT_ADDRESS as `0x${string}`,
					abi: [
						{
							name: "signCertificate",
							type: "function",
							stateMutability: "nonpayable",
							inputs: [
								{ name: "date", type: "uint256" },
								{ name: "hash", type: "bytes32" },
								{ name: "number", type: "string" },
								{ name: "recipient", type: "string" },
								{ name: "title", type: "string" },
							],
							outputs: [],
						},
					],
					functionName: "signCertificate",
					args: [BigInt(date), hash as `0x${string}`, number, recipient, title],
				});

				setPendingTxHash(txHash);

				const provider = contract.getProvider();
				const receipt = await provider.waitForTransaction(txHash);

				if (!receipt) {
					throw new Error("Transaction receipt not found");
				}

				const gasUsed = receipt.gasUsed;
				const effectiveGasPrice = receipt.gasPrice || 0n;
				const totalFee = gasUsed * effectiveGasPrice;

				const { ethers } = await import("ethers");

				return {
					txHash,
					gasUsed,
					effectiveGasPrice,
					totalFee,
					totalFeeETH: ethers.formatEther(totalFee),
				};
			} catch (error) {
				console.error("Error signing certificate on-chain:", error);
				throw new Error(
					`Failed to sign certificate: ${
						error instanceof Error ? error.message : "Unknown error"
					}`
				);
			} finally {
				setPendingTxHash(undefined);
			}
		},
		[address, isConnected, chainId, writeContractAsync]
	);

	return {
		address,
		isConnected,
		chainId,
		isConnecting,
		isSigning: isWriting || isWaitingTx,
		connect,
		connectors,
		disconnect,
		checkSignerStatus,
		signCertificateOnchain,
	};
}
