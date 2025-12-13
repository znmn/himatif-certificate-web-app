import {
	signDocumentOnchainSplit,
	verifyDocumentOnchain,
	type PositionType,
} from "./pdf-utils";
import { ethers } from "ethers";
import { OnchainVerificationContract } from "./contract";

export interface OnchainTestResult {
	fileName: string;
	signTime: number; // t_sign: waktu aplikasi (normalisasi, hash, kirim tx, dapat tx hash)
	confirmTime: number; // t_confirm: waktu konfirmasi blockchain
	signTimeTotal: number; // total = signTime + confirmTime
	verifyTime: number;
	// Sign operation gas data
	gasUsed: bigint;
	effectiveGasPrice: bigint;
	totalFee: bigint;
	totalFeeETH: string;
	txHash: string;
	// Verify operation gas data (kosong karena view function)
	verifyGasUsed?: bigint;
	verifyEffectiveGasPrice?: bigint;
	verifyTotalFee?: bigint;
	verifyTotalFeeETH?: string;
	verifyTxHash?: string;

	signedPdf?: Uint8Array;
	originalFileSizeBytes?: number;
	signedFileSizeBytes?: number;
	hash: string;
	number: string;
	recipient: string;
	title: string;
	timestamp: number;
	isValid: boolean;
	error?: string;
}

export interface OnchainTestStats {
	totalFiles: number;
	successfulSigns: number;
	successfulVerifies: number;
	averageSignTime: number; // rata-rata t_sign
	averageConfirmTime: number; // rata-rata t_confirm
	averageSignTimeTotal: number; // rata-rata total
	averageVerifyTime: number;
	totalGasUsed: bigint;
	totalFee: bigint;
	totalFeeETH: string;
	averageGasUsed: bigint;
	averageFee: bigint;
	averageFeeETH: string;
	signStats: {
		totalFiles: number;
		successful: number;
		averageTime: number; // t_sign
		averageTimeConfirm: number; // t_confirm
		averageTimeTotal: number; // total
		totalGasUsed: bigint;
		totalFee: bigint;
		totalFeeETH: string;
		averageGasUsed: bigint;
		averageFee: bigint;
		averageFeeETH: string;
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

// Menandatangani sertifikat on-chain menggunakan private key dengan pengukuran waktu terpisah
export async function signCertificateOnchainWithPrivateKey(
	privateKey: string,
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
	txSentTime: number; // waktu tx dikirim ke mempool
	confirmedTime: number; // waktu tx dikonfirmasi
}> {
	try {
		if (!privateKey.startsWith("0x")) {
			privateKey = `0x${privateKey}`;
		}

		const contract = OnchainVerificationContract.getInstance();
		const provider = contract.getProvider();
		const wallet = new ethers.Wallet(privateKey, provider);

		const result = await contract.signCertificateSplit(
			wallet,
			date,
			hash,
			number,
			recipient,
			title
		);

		return {
			txHash: result.txHash,
			gasUsed: result.gasUsed,
			effectiveGasPrice: result.effectiveGasPrice,
			totalFee: result.totalFee,
			totalFeeETH: result.totalFeeETH,
			txSentTime: result.txSentTime,
			confirmedTime: result.confirmedTime,
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

// Menandatangani dokumen dengan pengukuran waktu terpisah untuk onchain (signTime: waktu aplikasi, confirmTime: waktu konfirmasi blockchain)
export async function signDocumentOnchainWithTiming(
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
	) => Promise<{
		txHash: string;
		gasUsed: bigint;
		effectiveGasPrice: bigint;
		totalFee: bigint;
		totalFeeETH: string;
		txSentTime: number;
		confirmedTime: number;
	}>
): Promise<{
	signedPdf: Uint8Array;
	hash: string;
	qrUrl: string;
	timestamp: number;
	signTime: number; // t_sign
	confirmTime: number; // t_confirm
	signTimeTotal: number; // total
	txHash: string;
	gasUsed: bigint;
	effectiveGasPrice: bigint;
	totalFee: bigint;
	totalFeeETH: string;
}> {
	const appStartTime = performance.now();

	const result = await signDocumentOnchainSplit(
		inputBytes,
		number,
		recipient,
		title,
		position,
		signFunction
	);

	const endTime = performance.now();

	// t_sign = waktu dari mulai sampai tx dikirim ke mempool
	const signTime = (result.txSentTime - appStartTime) / 1000;
	// t_confirm = waktu dari tx dikirim sampai confirmed
	const confirmTime = (result.confirmedTime - result.txSentTime) / 1000;
	// total waktu
	const signTimeTotal = (endTime - appStartTime) / 1000;

	return {
		signedPdf: result.signedPdf,
		hash: result.hash,
		qrUrl: result.qrUrl,
		timestamp: result.timestamp,
		txHash: result.txHash,
		gasUsed: result.gasUsed,
		effectiveGasPrice: result.effectiveGasPrice,
		totalFee: result.totalFee,
		totalFeeETH: result.totalFeeETH,
		signTime,
		confirmTime,
		signTimeTotal,
	};
}

// Memverifikasi dokumen dengan pengukuran waktu untuk onchain
export async function verifyDocumentOnchainWithTiming(
	inputBytes: Uint8Array,
	verifyFunction: (hash: string) => Promise<{
		isValid: boolean;
		date: number;
		number: string;
		recipient: string;
		title: string;
		signer: string;
		signerNameAtTime: string;
	}>
): Promise<{
	isValid: boolean;
	date: number;
	number: string;
	recipient: string;
	title: string;
	signer: string;
	signerNameAtTime: string;
	recalculatedHash: string;
	verifyTime: number;
}> {
	const startTime = performance.now();

	const result = await verifyDocumentOnchain(inputBytes, verifyFunction);

	const endTime = performance.now();
	const verifyTime = (endTime - startTime) / 1000;

	return { ...result, verifyTime };
}

function calculateAverage(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((acc, val) => acc + val, 0) / values.length;
}

function calculateAverageBigInt(values: bigint[]): bigint {
	if (values.length === 0) return 0n;
	return values.reduce((acc, val) => acc + val, 0n) / BigInt(values.length);
}

export function calculateOnchainStats(
	results: OnchainTestResult[]
): OnchainTestStats {
	const successfulSigns = results.filter(
		(r) => !r.error && r.signTimeTotal > 0
	).length;
	const successfulVerifies = results.filter(
		(r) => !r.error && r.isValid && r.verifyTime > 0
	).length;

	// Split timing metrics
	const signTimes = results
		.filter((r) => !r.error && r.signTime > 0)
		.map((r) => r.signTime);
	const confirmTimes = results
		.filter((r) => !r.error && r.confirmTime > 0)
		.map((r) => r.confirmTime);
	const signTimesTotal = results
		.filter((r) => !r.error && r.signTimeTotal > 0)
		.map((r) => r.signTimeTotal);
	const verifyTimes = results
		.filter((r) => !r.error && r.verifyTime > 0)
		.map((r) => r.verifyTime);

	const averageSignTime = calculateAverage(signTimes);
	const averageConfirmTime = calculateAverage(confirmTimes);
	const averageSignTimeTotal = calculateAverage(signTimesTotal);
	const averageVerifyTime = calculateAverage(verifyTimes);

	const gasUsedValues = results
		.filter((r) => r.gasUsed !== undefined)
		.map((r) => r.gasUsed);
	const feeValues = results
		.filter((r) => r.totalFee !== undefined)
		.map((r) => r.totalFee);

	const totalGasUsed =
		gasUsedValues.length > 0
			? gasUsedValues.reduce((acc, val) => acc + val, 0n)
			: 0n;
	const totalFee =
		feeValues.length > 0 ? feeValues.reduce((acc, val) => acc + val, 0n) : 0n;
	const totalFeeETH = ethers.formatEther(totalFee);

	const averageGasUsed =
		gasUsedValues.length > 0 ? calculateAverageBigInt(gasUsedValues) : 0n;
	const averageFee =
		feeValues.length > 0 ? calculateAverageBigInt(feeValues) : 0n;
	const averageFeeETH = ethers.formatEther(averageFee);

	return {
		totalFiles: results.length,
		successfulSigns,
		successfulVerifies,
		averageSignTime,
		averageConfirmTime,
		averageSignTimeTotal,
		averageVerifyTime,
		totalGasUsed,
		totalFee,
		totalFeeETH,
		averageGasUsed,
		averageFee,
		averageFeeETH,
		signStats: {
			totalFiles: results.length,
			successful: successfulSigns,
			averageTime: averageSignTime,
			averageTimeConfirm: averageConfirmTime,
			averageTimeTotal: averageSignTimeTotal,
			totalGasUsed,
			totalFee,
			totalFeeETH,
			averageGasUsed,
			averageFee,
			averageFeeETH,
		},
		verifyStats: {
			totalFiles: results.length,
			successful: successfulVerifies,
			averageTime: averageVerifyTime,
		},
	};
}

export function generateOnchainSignCSV(results: OnchainTestResult[]): string {
	const formatBytes = (bytes?: number): string =>
		bytes === undefined ? "" : bytes.toString();

	const headers = [
		"Nama File",
		"Waktu Tanda Tangan t_sign (s)",
		"Waktu Konfirmasi Blockchain t_confirm (s)",
		"Waktu Total (s)",
		"Ukuran File Asli (bytes)",
		"Ukuran File Setelah Ditandatangani (bytes)",
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
		"Error",
	];

	const rows = results.map((result) => [
		result.fileName,
		result.signTime.toFixed(6),
		result.confirmTime.toFixed(6),
		result.signTimeTotal.toFixed(6),
		formatBytes(result.originalFileSizeBytes),
		formatBytes(result.signedFileSizeBytes),
		result.gasUsed?.toString() || "",
		result.effectiveGasPrice?.toString() || "",
		result.totalFee?.toString() || "",
		result.totalFeeETH || "",
		result.txHash || "",
		result.hash,
		result.number,
		result.recipient,
		result.title,
		result.timestamp.toString(),
		result.error || "",
	]);

	return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

export function generateOnchainVerifyCSV(results: OnchainTestResult[]): string {
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

	// Menghasilkan CSV detail operasi verifikasi
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

export function generateOnchainStatsTXT(
	stats: OnchainTestStats,
	warmUpCount: number
): string {
	const lines: string[] = [];

	lines.push("=".repeat(60));
	lines.push("LAPORAN STATISTIK TES SIGN DAN VERIFY (FULL ONCHAIN)");
	lines.push("=".repeat(60));
	lines.push("");

	lines.push(`Jumlah Sesi Pemanasan: ${warmUpCount}`);
	lines.push(`Total File: ${stats.totalFiles}`);
	lines.push(`Tanda Tangan Berhasil: ${stats.successfulSigns}`);
	lines.push(`Verifikasi Berhasil: ${stats.successfulVerifies}`);
	lines.push("");

	lines.push("-".repeat(60));
	lines.push("RATA-RATA WAKTU EKSEKUSI TANDA TANGAN");
	lines.push("-".repeat(60));
	lines.push(
		`Rata-rata Waktu Tanda Tangan (t_sign): ${stats.averageSignTime.toFixed(
			6
		)}s`
	);
	lines.push(`  - Termasuk: normalisasi PDF, hashing, kirim tx ke mempool`);
	lines.push(
		`Rata-rata Waktu Konfirmasi Blockchain (t_confirm): ${stats.averageConfirmTime.toFixed(
			6
		)}s`
	);
	lines.push(`  - Termasuk: menunggu tx di-mine dan dikonfirmasi`);
	lines.push(
		`Rata-rata Waktu Total: ${stats.averageSignTimeTotal.toFixed(6)}s`
	);
	lines.push("");

	lines.push("-".repeat(60));
	lines.push("RATA-RATA WAKTU EKSEKUSI VERIFIKASI");
	lines.push("-".repeat(60));
	lines.push(
		`Rata-rata Waktu Verifikasi (t_verify): ${stats.averageVerifyTime.toFixed(
			6
		)}s`
	);
	lines.push("");

	lines.push("-".repeat(60));
	lines.push("EFISIENSI BIAYA GAS (ONCHAIN)");
	lines.push("-".repeat(60));
	lines.push(`Total Gas Used: ${stats.totalGasUsed.toString()}`);
	lines.push(`Total Fee: ${stats.totalFee.toString()} wei`);
	lines.push(`Total Fee: ${stats.totalFeeETH} ETH`);
	lines.push("");
	lines.push(`Rata-rata Gas Used: ${stats.averageGasUsed.toString()}`);
	lines.push(`Rata-rata Fee: ${stats.averageFee.toString()} wei`);
	lines.push(`Rata-rata Fee: ${stats.averageFeeETH} ETH`);
	lines.push("");

	lines.push("=".repeat(60));
	lines.push(`Dibuat pada: ${new Date().toLocaleString("id-ID")}`);
	lines.push("=".repeat(60));

	return lines.join("\n");
}

export async function performOnchainWarmUp(
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
	) => Promise<{
		txHash: string;
		gasUsed: bigint;
		effectiveGasPrice: bigint;
		totalFee: bigint;
		totalFeeETH: string;
		txSentTime: number;
		confirmedTime: number;
	}>,
	verifyFunction: (hash: string) => Promise<{
		isValid: boolean;
		date: number;
		number: string;
		recipient: string;
		title: string;
		signer: string;
		signerNameAtTime: string;
	}>,
	onLog?: (log: LogEntry) => void,
	shouldStop?: () => boolean
): Promise<void> {
	if (files.length === 0) return;

	const log = (message: string, type: LogEntry["type"] = "info") => {
		if (onLog) onLog({ timestamp: Date.now(), message, type });
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
		const { signedPdf } = await signDocumentOnchainWithTiming(
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

		await verifyDocumentOnchainWithTiming(signedPdf, verifyFunction);
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
