import {
	signDocument,
	verifyDocument,
	type PositionType,
	type ExtractedData,
} from "./pdf-utils";
import { ethers } from "ethers";
import { config } from "@/config";
import { VerificationContract } from "./contract";

export interface TestResult {
	fileName: string;
	signTime: number;
	verifyTime: number;
	// Sign operation gas data (kosong untuk hybrid karena tidak ada transaksi)
	gasUsed?: bigint;
	effectiveGasPrice?: bigint;
	totalFee?: bigint;
	totalFeeETH?: string;
	txHash?: string;
	// Verify operation gas data (kosong karena offchain verification)
	verifyGasUsed?: bigint;
	verifyEffectiveGasPrice?: bigint;
	verifyTotalFee?: bigint;
	verifyTotalFeeETH?: string;
	verifyTxHash?: string;

	signedPdf?: Uint8Array;
	originalFileSizeBytes?: number;
	signedFileSizeBytes?: number;
	hash: string;
	signature: string;
	number: string;
	recipient: string;
	title: string;
	timestamp: number;
	isValid: boolean;
	error?: string;
}

export interface TestStats {
	totalFiles: number;
	successfulSigns: number;
	successfulVerifies: number;
	averageSignTime: number;
	averageVerifyTime: number;
	totalGasUsed?: bigint;
	totalFee?: bigint;
	totalFeeETH?: string;
	averageGasUsed?: bigint;
	averageFee?: bigint;
	averageFeeETH?: string;
	signStats: {
		totalFiles: number;
		successful: number;
		averageTime: number;
		totalGasUsed?: bigint;
		totalFee?: bigint;
		totalFeeETH?: string;
		averageGasUsed?: bigint;
		averageFee?: bigint;
		averageFeeETH?: string;
	};
	verifyStats: {
		totalFiles: number;
		successful: number;
		averageTime: number;
	};
}

export interface LogEntry {
	timestamp: number;
	message: string;
	type: "info" | "success" | "error" | "warning";
}

// Menandatangani data sertifikat dengan EIP-712 menggunakan private key (hanya untuk pengujian)
export async function signCertificateWithPrivateKey(
	privateKey: string,
	date: number,
	hash: string,
	number: string,
	recipient: string,
	title: string
): Promise<string> {
	try {
		if (!privateKey.startsWith("0x")) {
			privateKey = `0x${privateKey}`;
		}

		const wallet = new ethers.Wallet(privateKey);

		const verificationContract = VerificationContract.getInstance();
		const contractInfo = await verificationContract.getContractInfo();
		const networkInfo = await verificationContract.getNetworkInfo();

		const domain = {
			name: contractInfo.appName,
			version: contractInfo.version,
			chainId: networkInfo.chainId,
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

		const signature = await wallet.signTypedData(domain, types, message);

		return signature;
	} catch (error) {
		console.error("Error signing certificate with private key:", error);
		throw new Error(
			`Failed to sign certificate: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		);
	}
}

// Menandatangani dokumen dengan pengukuran waktu menggunakan performance.now()
export async function signDocumentWithTiming(
	inputBytes: Uint8Array,
	number: string,
	recipient: string,
	title: string,
	position: PositionType,
	signFunction: (
		timestamp: number,
		fileHash: string,
		number: string,
		recipient: string,
		title: string
	) => Promise<string>
): Promise<{
	signedPdf: Uint8Array;
	hash: string;
	signature: string;
	qrUrl: string;
	timestamp: number;
	signTime: number;
}> {
	const startTime = performance.now();

	const result = await signDocument(
		inputBytes,
		number,
		recipient,
		title,
		position,
		signFunction
	);

	const endTime = performance.now();
	const signTime = (endTime - startTime) / 1000;

	return {
		...result,
		signTime,
	};
}

// Memverifikasi dokumen dengan pengukuran waktu menggunakan performance.now()
export async function verifyDocumentWithTiming(
	inputBytes: Uint8Array,
	verifyFunction: (
		timestamp: number,
		hash: string,
		number: string,
		recipient: string,
		title: string,
		signature: string
	) => Promise<{
		isValid: boolean;
		recoveredSigner: string;
		signerNameAtTime?: string;
	}>
): Promise<{
	isValid: boolean;
	recoveredSigner: string;
	signerNameAtTime: string;
	extractedData?: ExtractedData;
	recalculatedHash: string;
	verifyTime: number;
}> {
	const startTime = performance.now();

	const result = await verifyDocument(inputBytes, verifyFunction);

	const endTime = performance.now();
	const verifyTime = (endTime - startTime) / 1000;

	return {
		...result,
		verifyTime,
	};
}

// Mendapatkan receipt transaksi untuk kalkulasi gas
export async function getTransactionReceipt(
	txHash: string,
	provider: ethers.Provider
): Promise<{
	gasUsed: bigint;
	effectiveGasPrice: bigint;
	totalFee: bigint;
	totalFeeETH: string;
} | null> {
	try {
		const receipt = await provider.getTransactionReceipt(txHash);
		if (!receipt) return null;

		const gasUsed = receipt.gasUsed;
		const effectiveGasPrice = receipt.gasPrice || 0n;
		const totalFee = gasUsed * effectiveGasPrice;
		const totalFeeETH = ethers.formatEther(totalFee);

		return {
			gasUsed,
			effectiveGasPrice,
			totalFee,
			totalFeeETH,
		};
	} catch (error) {
		console.error("Error getting transaction receipt:", error);
		return null;
	}
}

// Menghitung rata-rata dari array angka
export function calculateAverage(values: number[]): number {
	if (values.length === 0) return 0;
	const sum = values.reduce((acc, val) => acc + val, 0);
	return sum / values.length;
}

// Menghitung rata-rata dari array bigint
export function calculateAverageBigInt(values: bigint[]): bigint {
	if (values.length === 0) return 0n;
	const sum = values.reduce((acc, val) => acc + val, 0n);
	return sum / BigInt(values.length);
}

// Menghitung statistik dari hasil tes
export function calculateStats(results: TestResult[]): TestStats {
	const successfulSigns = results.filter(
		(r) => !r.error && r.signTime > 0
	).length;
	const successfulVerifies = results.filter(
		(r) => !r.error && r.isValid && r.verifyTime > 0
	).length;

	const signTimes = results
		.filter((r) => !r.error && r.signTime > 0)
		.map((r) => r.signTime);
	const verifyTimes = results
		.filter((r) => !r.error && r.verifyTime > 0)
		.map((r) => r.verifyTime);

	const averageSignTime = calculateAverage(signTimes);
	const averageVerifyTime = calculateAverage(verifyTimes);

	const gasUsedValues = results
		.filter((r) => r.gasUsed !== undefined)
		.map((r) => r.gasUsed!);
	const feeValues = results
		.filter((r) => r.totalFee !== undefined)
		.map((r) => r.totalFee!);

	const totalGasUsed =
		gasUsedValues.length > 0
			? gasUsedValues.reduce((acc, val) => acc + val, 0n)
			: undefined;
	const totalFee =
		feeValues.length > 0
			? feeValues.reduce((acc, val) => acc + val, 0n)
			: undefined;
	const totalFeeETH = totalFee ? ethers.formatEther(totalFee) : undefined;

	const averageGasUsed =
		gasUsedValues.length > 0
			? calculateAverageBigInt(gasUsedValues)
			: undefined;
	const averageFee =
		feeValues.length > 0 ? calculateAverageBigInt(feeValues) : undefined;
	const averageFeeETH = averageFee ? ethers.formatEther(averageFee) : undefined;

	const signResults = results.filter((r) => !r.error && r.signTime > 0);
	const signGasUsedValues = signResults
		.filter((r) => r.gasUsed !== undefined)
		.map((r) => r.gasUsed!);
	const signFeeValues = signResults
		.filter((r) => r.totalFee !== undefined)
		.map((r) => r.totalFee!);

	const signTotalGasUsed =
		signGasUsedValues.length > 0
			? signGasUsedValues.reduce((acc, val) => acc + val, 0n)
			: undefined;
	const signTotalFee =
		signFeeValues.length > 0
			? signFeeValues.reduce((acc, val) => acc + val, 0n)
			: undefined;
	const signTotalFeeETH = signTotalFee
		? ethers.formatEther(signTotalFee)
		: undefined;
	const signAverageGasUsed =
		signGasUsedValues.length > 0
			? calculateAverageBigInt(signGasUsedValues)
			: undefined;
	const signAverageFee =
		signFeeValues.length > 0
			? calculateAverageBigInt(signFeeValues)
			: undefined;
	const signAverageFeeETH = signAverageFee
		? ethers.formatEther(signAverageFee)
		: undefined;

	const verifyResults = results.filter((r) => !r.error && r.verifyTime > 0);

	return {
		totalFiles: results.length,
		successfulSigns,
		successfulVerifies,
		averageSignTime,
		averageVerifyTime,
		totalGasUsed,
		totalFee,
		totalFeeETH,
		averageGasUsed,
		averageFee,
		averageFeeETH,
		signStats: {
			totalFiles: signResults.length,
			successful: successfulSigns,
			averageTime: averageSignTime,
			totalGasUsed: signTotalGasUsed,
			totalFee: signTotalFee,
			totalFeeETH: signTotalFeeETH,
			averageGasUsed: signAverageGasUsed,
			averageFee: signAverageFee,
			averageFeeETH: signAverageFeeETH,
		},
		verifyStats: {
			totalFiles: verifyResults.length,
			successful: successfulVerifies,
			averageTime: averageVerifyTime,
		},
	};
}

// Menghasilkan CSV detail operasi tanda tangan
export function generateSignCSV(results: TestResult[]): string {
	const formatBytes = (bytes?: number): string => {
		if (bytes === undefined) return "";
		return bytes.toString();
	};

	const headers = [
		"Nama File",
		"Lama Eksekusi Tanda Tangan (s)",
		"Ukuran File Asli (bytes)",
		"Ukuran File Setelah Ditandatangani (bytes)",
		"Gas Used",
		"Effective Gas Price (wei)",
		"Total Fee (wei)",
		"Total Fee (ETH)",
		"TX Hash",
		"Hash",
		"Signature",
		"Nomor Sertifikat",
		"Recipient",
		"Title",
		"Timestamp",
		"Error",
	];

	const rows = results.map((result) => [
		result.fileName,
		result.signTime.toFixed(6),
		formatBytes(result.originalFileSizeBytes),
		formatBytes(result.signedFileSizeBytes),
		result.gasUsed?.toString() || "",
		result.effectiveGasPrice?.toString() || "",
		result.totalFee?.toString() || "",
		result.totalFeeETH || "",
		result.txHash || "",
		result.hash,
		result.signature,
		result.number,
		result.recipient,
		result.title,
		result.timestamp.toString(),
		result.error || "",
	]);

	return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

// Menghasilkan CSV detail operasi verifikasi
// Untuk pendekatan hybrid, verifikasi dilakukan secara offchain
// sehingga tidak ada gas dan TX Hash. Kolom tetap disertakan untuk konsistensi.
export function generateVerifyCSV(results: TestResult[]): string {
	const headers = [
		"Nama File",
		"Lama Eksekusi Verifikasi (s)",
		"Gas Used",
		"Effective Gas Price (wei)",
		"Total Fee (wei)",
		"Total Fee (ETH)",
		"TX Hash",
		"Hash",
		"Nomor Sertifikat",
		"Recipient",
		"Title",
		"Timestamp",
		"Valid",
		"Error",
	];

	// Menggunakan field verify* yang terpisah dari field sign
	const rows = results.map((result) => [
		result.fileName,
		result.verifyTime.toFixed(6),
		result.verifyGasUsed?.toString() || "",
		result.verifyEffectiveGasPrice?.toString() || "",
		result.verifyTotalFee?.toString() || "",
		result.verifyTotalFeeETH || "",
		result.verifyTxHash || "",
		result.hash,
		result.number,
		result.recipient,
		result.title,
		result.timestamp.toString(),
		result.isValid ? "Yes" : "No",
		result.error || "",
	]);

	return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

// Menghasilkan laporan statistik TXT
export function generateStatsTXT(
	stats: TestStats,
	warmUpCount: number
): string {
	const lines: string[] = [];

	lines.push("=".repeat(60));
	lines.push("LAPORAN STATISTIK TES SIGN DAN VERIFY");
	lines.push("=".repeat(60));
	lines.push("");

	lines.push(`Jumlah Sesi Pemanasan: ${warmUpCount}`);
	lines.push(`Total File: ${stats.totalFiles}`);
	lines.push(`Tanda Tangan Berhasil: ${stats.successfulSigns}`);
	lines.push(`Verifikasi Berhasil: ${stats.successfulVerifies}`);
	lines.push("");

	lines.push("-".repeat(60));
	lines.push("RATA-RATA WAKTU EKSEKUSI");
	lines.push("-".repeat(60));
	lines.push(
		`Rata-rata Waktu Tanda Tangan (t_sign): ${stats.averageSignTime.toFixed(
			6
		)}s`
	);
	lines.push(
		`Rata-rata Waktu Verifikasi (t_verify): ${stats.averageVerifyTime.toFixed(
			6
		)}s`
	);
	lines.push("");

	if (stats.totalGasUsed !== undefined) {
		lines.push("-".repeat(60));
		lines.push("EFISIENSI BIAYA GAS");
		lines.push("-".repeat(60));
		lines.push(`Total Gas Used: ${stats.totalGasUsed.toString()}`);
		lines.push(`Total Fee: ${stats.totalFee?.toString() || "N/A"} wei`);
		lines.push(`Total Fee: ${stats.totalFeeETH || "N/A"} ETH`);
		lines.push("");

		if (stats.averageGasUsed !== undefined) {
			lines.push(`Rata-rata Gas Used: ${stats.averageGasUsed.toString()}`);
			lines.push(`Rata-rata Fee: ${stats.averageFee?.toString() || "N/A"} wei`);
			lines.push(`Rata-rata Fee: ${stats.averageFeeETH || "N/A"} ETH`);
			lines.push("");
		}
	}

	lines.push("=".repeat(60));
	lines.push(`Dibuat pada: ${new Date().toLocaleString("id-ID")}`);
	lines.push("=".repeat(60));

	return lines.join("\n");
}

// Melakukan sesi pemanasan
export async function performWarmUp(
	files: File[],
	number: string,
	recipient: string,
	title: string,
	position: PositionType,
	signFunction: (
		timestamp: number,
		fileHash: string,
		number: string,
		recipient: string,
		title: string
	) => Promise<string>,
	verifyFunction: (
		timestamp: number,
		hash: string,
		number: string,
		recipient: string,
		title: string,
		signature: string
	) => Promise<{
		isValid: boolean;
		recoveredSigner: string;
		signerNameAtTime?: string;
	}>,
	onLog?: (log: LogEntry) => void,
	shouldStop?: () => boolean
): Promise<void> {
	if (files.length === 0) return;

	const log = (message: string, type: LogEntry["type"] = "info") => {
		if (onLog) {
			onLog({
				timestamp: Date.now(),
				message,
				type,
			});
		}
	};

	const warmUpFile = files[0];
	if (shouldStop?.()) {
		log("Sesi pemanasan dibatalkan sebelum mulai", "warning");
		return;
	}
	const fileBuffer = await warmUpFile.arrayBuffer();
	const fileBytes = new Uint8Array(fileBuffer);

	try {
		log(`Memulai sesi pemanasan dengan file: ${warmUpFile.name}`, "info");
		const { signedPdf } = await signDocumentWithTiming(
			fileBytes,
			number,
			recipient,
			title,
			position,
			signFunction
		);

		if (shouldStop?.()) {
			log("Sesi pemanasan dibatalkan setelah proses tanda tangan", "warning");
			return;
		}

		await verifyDocumentWithTiming(signedPdf, verifyFunction);
		log(`Sesi pemanasan selesai`, "success");
	} catch (error) {
		log(
			`Error dalam sesi pemanasan: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			"error"
		);
	}
}
