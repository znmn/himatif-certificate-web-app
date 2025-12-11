import React, { useState, useCallback, useRef } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Position, type PositionType } from "@/lib/full/pdf-utils";
import { OnchainVerificationContract } from "@/lib/full/contract";
import { config } from "@/config";
import {
	signDocumentOnchainWithTiming,
	verifyDocumentOnchainWithTiming,
	calculateOnchainStats,
	generateOnchainSignCSV,
	generateOnchainVerifyCSV,
	generateOnchainStatsTXT,
	performOnchainWarmUp,
	signCertificateOnchainWithPrivateKey,
	type OnchainTestResult,
	type OnchainTestStats,
	type LogEntry,
} from "@/lib/full/test-utils";
import {
	Download,
	FileText,
	Wallet,
	AlertCircle,
	CheckCircle,
	TestTube,
	Play,
	Trash2,
	FileSpreadsheet,
	FileCode,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import Papa from "papaparse";
import { ethers } from "ethers";
import {
	FileUpload,
	ActionButtons,
	ResultCard,
	ProgressCard,
	FormField,
	AlertBox,
	LogViewer,
	DropdownSelector,
} from "@/components/web";

const TestsOnchain: React.FC = () => {
	const [privateKey, setPrivateKey] = useState("");
	const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);
	const [signerAddress, setSignerAddress] = useState<string | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [position, setPosition] = useState<PositionType>(Position.MiddleLeft);
	const [warmUpCount, setWarmUpCount] = useState(10);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [progress, setProgress] = useState(0);
	const [results, setResults] = useState<OnchainTestResult[]>([]);
	const [stats, setStats] = useState<OnchainTestStats | null>(null);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [csvFile, setCsvFile] = useState<File | null>(null);
	const [csvData, setCsvData] = useState<
		Array<{
			"Nama File": string;
			"Nomor Sertifikat": string;
			Penerima: string;
			Pencapaian: string;
		}>
	>([]);
	const [csvError, setCsvError] = useState<string | null>(null);
	const shouldStopRef = useRef(false);

	React.useEffect(() => {
		const validatePrivateKey = async () => {
			if (!privateKey.trim()) {
				setPrivateKeyError(null);
				setSignerAddress(null);
				return;
			}

			try {
				let normalizedKey = privateKey.trim();
				if (!normalizedKey.startsWith("0x"))
					normalizedKey = `0x${normalizedKey}`;

				if (normalizedKey.length !== 66) {
					setPrivateKeyError(
						"Private key harus 64 karakter hex (66 dengan 0x)"
					);
					setSignerAddress(null);
					return;
				}

				const wallet = new ethers.Wallet(normalizedKey);
				const address = await wallet.getAddress();
				setSignerAddress(address);
				setPrivateKeyError(null);

				try {
					const contract = OnchainVerificationContract.getInstance();
					const contractInfo = await contract.getContractInfo();
					if (
						contractInfo.signerAddress.toLowerCase() !== address.toLowerCase()
					) {
						setPrivateKeyError(
							"Peringatan: Alamat dari private key tidak cocok dengan penandatangan yang terdaftar di kontrak"
						);
					}
				} catch (err) {
					// Mengabaikan error pemeriksaan kontrak
				}
			} catch (err) {
				setPrivateKeyError(
					err instanceof Error ? err.message : "Private key tidak valid"
				);
				setSignerAddress(null);
			}
		};

		validatePrivateKey();
	}, [privateKey]);

	const addLog = useCallback(
		(message: string, type: LogEntry["type"] = "info") => {
			setLogs((prev) => [...prev, { timestamp: Date.now(), message, type }]);
		},
		[]
	);

	const runTests = async () => {
		if (!files.length) {
			setError("Harap unggah file PDF");
			return;
		}
		if (!csvData.length) {
			setError("Harap unggah file CSV yang valid dengan metadata");
			return;
		}
		if (!privateKey.trim()) {
			setError("Harap masukkan private key untuk signing");
			return;
		}
		if (privateKeyError) {
			setError(privateKeyError);
			return;
		}
		if (!signerAddress) {
			setError("Private key tidak valid");
			return;
		}

		setIsProcessing(true);
		setIsStopping(false);
		shouldStopRef.current = false;
		setProgress(0);
		setError(null);
		setResults([]);
		setStats(null);
		setLogs([]);

		const testResults: OnchainTestResult[] = [];
		const contract = OnchainVerificationContract.getInstance();

		const metadataMap = new Map<
			string,
			{
				"Nama File": string;
				"Nomor Sertifikat": string;
				Penerima: string;
				Pencapaian: string;
			}
		>();
		csvData.forEach((row) => metadataMap.set(row["Nama File"], row));

		const signFunction = async (
			timestamp: number,
			fileHash: string,
			number: string,
			recipient: string,
			title: string
		) => {
			return signCertificateOnchainWithPrivateKey(
				privateKey,
				timestamp,
				fileHash,
				number,
				recipient,
				title
			);
		};

		try {
			// Sesi pemanasan
			if (warmUpCount > 0 && files.length > 0) {
				addLog(`Memulai ${warmUpCount} sesi pemanasan...`, "info");
				const warmUpFile = files[0];
				const warmUpMetadata = metadataMap.get(warmUpFile.name);

				if (warmUpMetadata) {
					for (let i = 0; i < warmUpCount; i++) {
						if (shouldStopRef.current) {
							addLog(
								`Sesi pemanasan dihentikan pada iterasi ${
									i + 1
								}/${warmUpCount}`,
								"warning"
							);
							break;
						}
						addLog(`Sesi pemanasan ${i + 1}/${warmUpCount}`, "info");
						await performOnchainWarmUp(
							[warmUpFile],
							warmUpMetadata["Nomor Sertifikat"],
							warmUpMetadata.Penerima,
							warmUpMetadata.Pencapaian,
							position,
							signFunction,
							contract.verifyCertificate.bind(contract),
							(log) => addLog(log.message, log.type),
							() => shouldStopRef.current
						);
					}
					if (!shouldStopRef.current)
						addLog(`Sesi pemanasan selesai`, "success");
				}
			}

			if (!shouldStopRef.current) {
				addLog(`Memulai tes dengan ${files.length} file`, "info");

				for (let i = 0; i < files.length; i++) {
					if (shouldStopRef.current) {
						addLog("Tes dihentikan oleh user", "warning");
						break;
					}

					const file = files[i];
					const fileBuffer = await file.arrayBuffer();
					const originalFileSize = fileBuffer.byteLength;
					addLog(
						`Memproses file ${i + 1}/${files.length}: ${file.name}`,
						"info"
					);

					const metadata = metadataMap.get(file.name);

					if (!metadata) {
						const errorMessage = `Tidak ada metadata ditemukan untuk file: ${file.name}`;
						addLog(errorMessage, "error");
						testResults.push({
							fileName: file.name,
							signTime: 0,
							confirmTime: 0,
							signTimeTotal: 0,
							verifyTime: 0,
							gasUsed: 0n,
							effectiveGasPrice: 0n,
							totalFee: 0n,
							totalFeeETH: "0",
							txHash: "",
							hash: "",
							number: "",
							recipient: "",
							title: "",
							timestamp: 0,
							isValid: false,
							error: errorMessage,
							originalFileSizeBytes: originalFileSize,
						});
						setProgress(((i + 1) / files.length) * 100);
						setResults([...testResults]);
						continue;
					}

					try {
						const fileBytes = new Uint8Array(fileBuffer);

						addLog(`Menandatangani ${file.name} on-chain...`, "info");
						const signResult = await signDocumentOnchainWithTiming(
							fileBytes,
							metadata["Nomor Sertifikat"],
							metadata.Penerima,
							metadata.Pencapaian,
							position,
							signFunction
						);
						const signedFileSize = signResult.signedPdf.length;

						addLog(`Tanda tangan selesai: ${file.name}`, "success");
						addLog(
							`  - Waktu Tanda Tangan (t_sign): ${signResult.signTime.toFixed(
								6
							)}s`,
							"info"
						);
						addLog(
							`  - Waktu Konfirmasi (t_confirm): ${signResult.confirmTime.toFixed(
								6
							)}s`,
							"info"
						);
						addLog(
							`  - Waktu Total: ${signResult.signTimeTotal.toFixed(6)}s`,
							"info"
						);
						addLog(`TX Hash: ${signResult.txHash}`, "info");
						addLog(`Hash: ${signResult.hash}`, "info");
						addLog(`Nomor Sertifikat: ${metadata["Nomor Sertifikat"]}`, "info");
						addLog(`Gas Used: ${signResult.gasUsed.toString()}`, "info");
						addLog(`Fee: ${signResult.totalFeeETH} ETH`, "info");

						if (shouldStopRef.current) {
							addLog(
								`Tes dihentikan setelah tanda tangan ${file.name}`,
								"warning"
							);
							break;
						}

						addLog(`Memverifikasi ${file.name}...`, "info");
						const verifyResult = await verifyDocumentOnchainWithTiming(
							signResult.signedPdf,
							contract.verifyCertificate.bind(contract)
						);
						addLog(
							`Verifikasi selesai: ${
								file.name
							} (${verifyResult.verifyTime.toFixed(6)}s) - ${
								verifyResult.isValid ? "Valid" : "Tidak Valid"
							}`,
							verifyResult.isValid ? "success" : "error"
						);

						testResults.push({
							fileName: file.name,
							signTime: signResult.signTime,
							confirmTime: signResult.confirmTime,
							signTimeTotal: signResult.signTimeTotal,
							verifyTime: verifyResult.verifyTime,
							gasUsed: signResult.gasUsed,
							effectiveGasPrice: signResult.effectiveGasPrice,
							totalFee: signResult.totalFee,
							totalFeeETH: signResult.totalFeeETH,
							txHash: signResult.txHash,
							hash: signResult.hash,
							number: metadata["Nomor Sertifikat"],
							recipient: metadata.Penerima,
							title: metadata.Pencapaian,
							timestamp: signResult.timestamp,
							isValid: verifyResult.isValid,
							signedPdf: signResult.signedPdf,
							originalFileSizeBytes: originalFileSize,
							signedFileSizeBytes: signedFileSize,
						});
					} catch (err) {
						const errorMessage =
							err instanceof Error ? err.message : "Unknown error";
						addLog(`Error memproses ${file.name}: ${errorMessage}`, "error");
						testResults.push({
							fileName: file.name,
							signTime: 0,
							confirmTime: 0,
							signTimeTotal: 0,
							verifyTime: 0,
							gasUsed: 0n,
							effectiveGasPrice: 0n,
							totalFee: 0n,
							totalFeeETH: "0",
							txHash: "",
							hash: "",
							number: metadata["Nomor Sertifikat"],
							recipient: metadata.Penerima,
							title: metadata.Pencapaian,
							timestamp: 0,
							isValid: false,
							error: errorMessage,
							originalFileSizeBytes: originalFileSize,
						});
					}

					setProgress(((i + 1) / files.length) * 100);
					setResults([...testResults]);
				}

				if (!shouldStopRef.current) {
					const calculatedStats = calculateOnchainStats(testResults);
					setStats(calculatedStats);
					addLog("Perhitungan statistik selesai", "success");
					addLog(
						`Rata-rata waktu tanda tangan (t_sign): ${calculatedStats.averageSignTime.toFixed(
							6
						)}s`,
						"info"
					);
					addLog(
						`Rata-rata waktu konfirmasi blockchain (t_confirm): ${calculatedStats.averageConfirmTime.toFixed(
							6
						)}s`,
						"info"
					);
					addLog(
						`Rata-rata waktu total: ${calculatedStats.averageSignTimeTotal.toFixed(
							6
						)}s`,
						"info"
					);
					addLog(
						`Rata-rata waktu verifikasi: ${calculatedStats.averageVerifyTime.toFixed(
							6
						)}s`,
						"info"
					);
					addLog(
						`Total Gas Used: ${calculatedStats.totalGasUsed.toString()}`,
						"info"
					);
					addLog(`Total Fee: ${calculatedStats.totalFeeETH} ETH`, "info");

					toast.success("Tes selesai!", {
						description: `Berhasil memproses ${testResults.length} file`,
					});
				}
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Gagal memproses file";
			setError(errorMessage);
			addLog(`Error: ${errorMessage}`, "error");
			toast.error("Gagal menjalankan tes", { description: errorMessage });
		} finally {
			setIsProcessing(false);
			setIsStopping(false);
			shouldStopRef.current = false;
			setProgress(0);
		}
	};

	const stopTests = () => {
		if (!isProcessing || shouldStopRef.current) return;
		shouldStopRef.current = true;
		setIsStopping(true);
		addLog("Permintaan penghentian diterima...", "warning");
		toast.warning("Sedang menghentikan tes...");
	};

	const downloadSignCSV = () => {
		if (results.length === 0) return;
		const csvContent = generateOnchainSignCSV(results);
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `test-onchain-sign-results-${Date.now()}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("CSV operasi tanda tangan berhasil diunduh!");
	};

	const downloadVerifyCSV = () => {
		if (results.length === 0) return;
		const csvContent = generateOnchainVerifyCSV(results);
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `test-onchain-verify-results-${Date.now()}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("CSV operasi verifikasi berhasil diunduh!");
	};

	const downloadStatsTXT = () => {
		if (!stats) return;
		const txtContent = generateOnchainStatsTXT(stats, warmUpCount);
		const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `test-onchain-stats-${Date.now()}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("Statistik berhasil diunduh!");
	};

	const downloadSignedPDFs = async () => {
		if (results.length === 0) return;
		const zip = new JSZip();
		const validResults = results.filter((r) => r.signedPdf);
		for (const result of validResults) {
			if (result.signedPdf)
				zip.file(`signed_${result.fileName}`, result.signedPdf);
		}
		const zipBlob = await zip.generateAsync({ type: "blob" });
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `signed-documents-onchain-${Date.now()}.zip`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("File PDF yang ditandatangani berhasil diunduh!");
	};

	const clearAll = () => {
		setFiles([]);
		setResults([]);
		setStats(null);
		setLogs([]);
		setError(null);
		setProgress(0);
		setCsvFile(null);
		setCsvData([]);
		setCsvError(null);
		toast.info("Semua data telah dihapus");
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-6xl">
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-2">
					<TestTube className="h-8 w-8" />
					Tests (Full Onchain)
				</h1>
				<p className="text-lg text-muted-foreground">
					Uji performa tanda tangan dan verifikasi on-chain untuk beberapa PDF
					sekaligus
				</p>
			</div>

			{/* Input Private Key */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Wallet className="h-5 w-5" />
						Private Key (Test Environment Only)
					</CardTitle>
					<CardDescription>
						Masukkan private key untuk signing on-chain otomatis
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							<strong>PERINGATAN KEAMANAN:</strong> Fitur ini hanya untuk
							lingkungan pengujian. JANGAN PERNAH menggunakan private key dari
							wallet utama. Private key akan digunakan untuk transaksi on-chain
							yang memerlukan gas fee.
						</AlertDescription>
					</Alert>

					<FormField
						id="private-key"
						label="Private Key"
						type="password"
						value={privateKey}
						onChange={setPrivateKey}
						placeholder="0x..."
						disabled={isProcessing}
						description="Format: 64 karakter hex (dengan atau tanpa prefix 0x)"
						className="font-mono text-sm"
						required
					/>

					{privateKeyError && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{privateKeyError}</AlertDescription>
						</Alert>
					)}

					{signerAddress && !privateKeyError && (
						<Alert>
							<CheckCircle className="h-4 w-4" />
							<AlertDescription>
								<div className="space-y-1">
									<div>
										<strong>Alamat dari private key:</strong>
									</div>
									<code className="text-sm bg-muted px-2 py-1 rounded break-all block">
										{signerAddress}
									</code>
								</div>
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			{signerAddress && !privateKeyError && (
				<div className="space-y-6">
					{/* Kartu Konfigurasi */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								Konfigurasi Tes (Full Onchain)
							</CardTitle>
							<CardDescription>
								Atur parameter untuk tes tanda tangan dan verifikasi on-chain
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<FileUpload
								id="csv-upload"
								label="Unggah Metadata CSV"
								accept=".csv"
								files={csvFile ? [csvFile] : []}
								onChange={(files) => {
									const file = files[0];
									if (file) {
										setCsvFile(file);
										setCsvError(null);
										Papa.parse<{
											"Nama File": string;
											"Nomor Sertifikat": string;
											Penerima: string;
											Pencapaian: string;
										}>(file, {
											header: true,
											skipEmptyLines: true,
											complete: (results) => {
												const requiredHeaders = [
													"Nama File",
													"Nomor Sertifikat",
													"Penerima",
													"Pencapaian",
												];
												const csvHeaders = results.meta.fields || [];
												const missingHeaders = requiredHeaders.filter(
													(header) => !csvHeaders.includes(header)
												);
												if (missingHeaders.length > 0) {
													setCsvError(
														`File CSV kehilangan header: ${missingHeaders.join(
															", "
														)}`
													);
													setCsvData([]);
													return;
												}
												setCsvData(results.data);
												toast.success(
													`CSV berhasil diuraikan! Ditemukan ${results.data.length} catatan.`
												);
												addLog(
													`CSV berhasil diuraikan! Ditemukan ${results.data.length} catatan.`,
													"success"
												);
											},
											error: (error) => {
												setCsvError(`Gagal menguraikan CSV: ${error.message}`);
												setCsvData([]);
												addLog(
													`Gagal menguraikan CSV: ${error.message}`,
													"error"
												);
											},
										});
									} else {
										setCsvFile(null);
										setCsvData([]);
										setCsvError(null);
									}
								}}
								disabled={isProcessing}
								maxFiles={1}
								description='CSV harus berisi header: "Nama File", "Nomor Sertifikat", "Penerima", "Pencapaian"'
								required
							/>
							{csvError && (
								<AlertBox variant="destructive" message={csvError} />
							)}

							<DropdownSelector
								id="qr-position-test"
								label="Posisi Kode QR"
								value={position}
								onValueChange={setPosition}
								options={Object.values(Position)}
								menuLabel="Posisi Kode QR"
								disabled={isProcessing}
								required
							/>

							<FormField
								id="warmup"
								label="Jumlah Sesi Pemanasan"
								type="number"
								value={warmUpCount}
								onChange={(value) =>
									setWarmUpCount(Math.max(0, parseInt(value) || 0))
								}
								disabled={isProcessing}
								placeholder="10"
								description="Jumlah sesi pemanasan sebelum eksekusi tes utama (memerlukan gas fee)"
								required
							/>

							<FileUpload
								id="file-upload"
								label="Unggah File PDF (Multiple)"
								accept=".pdf"
								multiple={true}
								files={files}
								onChange={setFiles}
								disabled={isProcessing}
								required
							/>

							{isProcessing && (
								<ProgressCard progress={progress} isActive={true} />
							)}
							{error && <AlertBox variant="destructive" message={error} />}

							<ActionButtons
								buttons={[
									isProcessing
										? {
												id: "stop-test",
												label: isStopping ? "Menghentikan..." : "Hentikan Tes",
												onClick: stopTests,
												variant: "destructive",
												loading: isStopping,
												disabled: isStopping,
												className: "flex-1",
										  }
										: {
												id: "run-test",
												label: "Jalankan Tes On-Chain",
												onClick: runTests,
												disabled:
													!files.length ||
													!csvData.length ||
													!!csvError ||
													!privateKey.trim() ||
													!!privateKeyError,
												icon: <Play className="h-4 w-4" />,
												className: "flex-1",
										  },
									{
										id: "clear-all-test",
										label: "Hapus Semua",
										onClick: clearAll,
										variant: "destructive",
										disabled: isProcessing,
										icon: <Trash2 className="h-4 w-4" />,
									},
								]}
							/>
						</CardContent>
					</Card>

					{signerAddress && !privateKeyError && <LogViewer logs={logs} />}

					{/* Statistik */}
					{stats && (
						<div className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										<span className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5 text-green-500" />
											Statistik Operasi Tanda Tangan (On-Chain)
										</span>
										<div className="flex flex-col sm:flex-row gap-2">
											<Button
												onClick={downloadStatsTXT}
												variant="outline"
												size="sm"
											>
												<FileCode className="mr-2 h-4 w-4" />
												TXT Stats
											</Button>
											<Button
												onClick={downloadSignCSV}
												variant="outline"
												size="sm"
											>
												<FileSpreadsheet className="mr-2 h-4 w-4" />
												CSV Sign
											</Button>
											<Button
												onClick={downloadSignedPDFs}
												variant="outline"
												size="sm"
											>
												<Download className="mr-2 h-4 w-4" />
												PDF(s)
											</Button>
										</div>
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										<div className="space-y-2">
											<Label className="text-sm font-medium">Total File</Label>
											<p className="text-2xl font-bold">
												{stats.signStats.totalFiles}
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Tanda Tangan Berhasil
											</Label>
											<p className="text-2xl font-bold text-green-500">
												{stats.signStats.successful}
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Rata-rata Waktu Tanda Tangan (t_sign)
											</Label>
											<p className="text-2xl font-bold">
												{stats.signStats.averageTime.toFixed(6)}s
											</p>
											<p className="text-xs text-muted-foreground">
												Normalisasi, hash, kirim tx
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Rata-rata Waktu Konfirmasi (t_confirm)
											</Label>
											<p className="text-2xl font-bold">
												{stats.signStats.averageTimeConfirm.toFixed(6)}s
											</p>
											<p className="text-xs text-muted-foreground">
												Menunggu tx di-mine
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Rata-rata Waktu Total
											</Label>
											<p className="text-2xl font-bold">
												{stats.signStats.averageTimeTotal.toFixed(6)}s
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Total Gas Used
											</Label>
											<p className="text-2xl font-bold">
												{stats.signStats.totalGasUsed.toString()}
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Total Fee (ETH)
											</Label>
											<p className="text-2xl font-bold">
												{stats.signStats.totalFeeETH}
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Rata-rata Fee (ETH)
											</Label>
											<p className="text-2xl font-bold">
												{stats.signStats.averageFeeETH}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										<span className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5 text-green-500" />
											Statistik Operasi Verifikasi
										</span>
										<Button
											onClick={downloadVerifyCSV}
											variant="outline"
											size="sm"
										>
											<FileSpreadsheet className="mr-2 h-4 w-4" />
											CSV Verify
										</Button>
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										<div className="space-y-2">
											<Label className="text-sm font-medium">Total File</Label>
											<p className="text-2xl font-bold">
												{stats.verifyStats.totalFiles}
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Verifikasi Berhasil
											</Label>
											<p className="text-2xl font-bold text-green-500">
												{stats.verifyStats.successful}
											</p>
										</div>
										<div className="space-y-2">
											<Label className="text-sm font-medium">
												Rata-rata Waktu (t_verify)
											</Label>
											<p className="text-2xl font-bold">
												{stats.verifyStats.averageTime.toFixed(6)}s
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Tabel Hasil */}
					{results.length > 0 && (
						<ResultCard
							title="Detail Hasil (On-Chain)"
							description="Detail hasil dan unduhan per file yang ditandatangani on-chain"
							items={results.map((result) => ({
								id: result.fileName,
								title: result.fileName,
								status: result.error
									? "error"
									: result.isValid
									? "success"
									: "error",
								badge: result.error
									? "Error"
									: result.isValid
									? "Valid"
									: "Invalid",
								details: [
									{ label: "Hash", value: result.hash, truncate: true },
									{
										label: "TX Hash",
										value: result.txHash || "-",
										truncate: true,
										link: result.txHash
											? `${config.BLOCK_EXPLORER_URL}/tx/${result.txHash}`
											: undefined,
									},
									{
										label: "Tanggal",
										value:
											result.timestamp > 0
												? new Date(result.timestamp * 1000).toLocaleString()
												: "-",
									},
									{
										label: "Penerima",
										value: result.recipient,
										truncate: true,
									},
									{ label: "Pencapaian", value: result.title, truncate: true },
									{
										label: "Waktu Tanda Tangan (t_sign)",
										value: `${result.signTime.toFixed(6)}s`,
									},
									{
										label: "Waktu Konfirmasi (t_confirm)",
										value: `${result.confirmTime.toFixed(6)}s`,
									},
									{
										label: "Waktu Total Tanda Tangan",
										value: `${result.signTimeTotal.toFixed(6)}s`,
									},
									{
										label: "Waktu Verifikasi",
										value: `${result.verifyTime.toFixed(6)}s`,
									},
									...(result.originalFileSizeBytes
										? [
												{
													label: "Ukuran Asli",
													value: `${result.originalFileSizeBytes.toLocaleString()} bytes`,
												},
										  ]
										: []),
									...(result.signedFileSizeBytes
										? [
												{
													label: "Ukuran Setelah Tanda Tangan",
													value: `${result.signedFileSizeBytes.toLocaleString()} bytes`,
												},
										  ]
										: []),
									{ label: "Gas Used", value: result.gasUsed.toString() },
									{ label: "Fee", value: `${result.totalFeeETH} ETH` },
								],
								downloadable: !!result.signedPdf,
								onDownload: result.signedPdf
									? () => {
											const blob = new Blob(
												[Uint8Array.from(result.signedPdf!)],
												{ type: "application/pdf" }
											);
											const url = URL.createObjectURL(blob);
											const a = document.createElement("a");
											a.href = url;
											a.download = `signed_${result.fileName}`;
											document.body.appendChild(a);
											a.click();
											document.body.removeChild(a);
											URL.revokeObjectURL(url);
											toast.success(
												`File signed_${result.fileName} berhasil diunduh`
											);
									  }
									: undefined,
							}))}
						/>
					)}
				</div>
			)}
		</div>
	);
};

export default TestsOnchain;
