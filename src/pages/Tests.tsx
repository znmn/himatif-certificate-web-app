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
import { Position, type PositionType } from "@/lib/pdf-utils";
import { VerificationContract } from "@/lib/contract";
import {
	signDocumentWithTiming,
	verifyDocumentWithTiming,
	calculateStats,
	generateSignCSV,
	generateVerifyCSV,
	generateStatsTXT,
	performWarmUp,
	signCertificateWithPrivateKey,
	type TestResult,
	type TestStats,
	type LogEntry,
} from "@/lib/test-utils";
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

const Tests: React.FC = () => {
	const [privateKey, setPrivateKey] = useState("");
	const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);
	const [signerAddress, setSignerAddress] = useState<string | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [position, setPosition] = useState<PositionType>(Position.MiddleLeft);
	const [warmUpCount, setWarmUpCount] = useState(10);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [progress, setProgress] = useState(0);
	const [results, setResults] = useState<TestResult[]>([]);
	const [stats, setStats] = useState<TestStats | null>(null);
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

	// Memvalidasi private key dan mendapatkan alamat
	React.useEffect(() => {
		const validatePrivateKey = async () => {
			if (!privateKey.trim()) {
				setPrivateKeyError(null);
				setSignerAddress(null);
				return;
			}

			try {
				// Menormalisasi format private key
				let normalizedKey = privateKey.trim();
				if (!normalizedKey.startsWith("0x")) {
					normalizedKey = `0x${normalizedKey}`;
				}

				// Memvalidasi format private key (harus 66 karakter dengan prefix 0x)
				if (normalizedKey.length !== 66) {
					setPrivateKeyError(
						"Private key harus 64 karakter hex (66 dengan 0x)"
					);
					setSignerAddress(null);
					return;
				}

				// Mencoba membuat wallet untuk validasi
				const wallet = new ethers.Wallet(normalizedKey);
				const address = await wallet.getAddress();
				setSignerAddress(address);
				setPrivateKeyError(null);

				// Memeriksa apakah alamat ini cocok dengan penandatangan kontrak
				try {
					const contract = VerificationContract.getInstance();
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
			setLogs((prev) => [
				...prev,
				{
					timestamp: Date.now(),
					message,
					type,
				},
			]);
		},
		[]
	);

	const runTests = async () => {
		// Memvalidasi input
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
			setError("Private key tidak valid atau tidak dapat menghasilkan alamat");
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

		const testResults: TestResult[] = [];
		const contract = VerificationContract.getInstance();

		// Membuat map metadata dari CSV
		const metadataMap = new Map<
			string,
			{
				"Nama File": string;
				"Nomor Sertifikat": string;
				Penerima: string;
				Pencapaian: string;
			}
		>();
		csvData.forEach((row) => {
			metadataMap.set(row["Nama File"], row);
		});

		// Membuat fungsi tanda tangan menggunakan private key
		const signFunction = async (
			timestamp: number,
			fileHash: string,
			number: string,
			recipient: string,
			title: string
		): Promise<string> => {
			return signCertificateWithPrivateKey(
				privateKey,
				timestamp,
				fileHash,
				number,
				recipient,
				title
			);
		};

		try {
			// Sesi pemanasan - menggunakan file pertama dengan metadata dari CSV
			if (warmUpCount > 0 && files.length > 0) {
				addLog(`Memulai ${warmUpCount} sesi pemanasan...`, "info");
				const warmUpFile = files[0];
				const warmUpMetadata = metadataMap.get(warmUpFile.name);

				if (!warmUpMetadata) {
					addLog(
						`Tidak ada metadata ditemukan untuk file warm-up: ${warmUpFile.name}`,
						"warning"
					);
					// Melewati pemanasan jika tidak ada metadata
				} else {
					const warmUpNumber = warmUpMetadata["Nomor Sertifikat"];
					const warmUpRecipient = warmUpMetadata.Penerima;
					const warmUpTitle = warmUpMetadata.Pencapaian;

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
						await performWarmUp(
							[warmUpFile],
							warmUpNumber,
							warmUpRecipient,
							warmUpTitle,
							position,
							signFunction,
							contract.verifyCertificate.bind(contract),
							(log) => addLog(log.message, log.type),
							() => shouldStopRef.current
						);
					}
					if (!shouldStopRef.current) {
						addLog(`Sesi pemanasan selesai`, "success");
					}
				}
			}

			if (shouldStopRef.current) {
				addLog(
					"Tes dihentikan oleh user sebelum memasuki tahap eksekusi utama",
					"warning"
				);
			} else {
				// Eksekusi tes utama
				addLog(`Memulai tes dengan ${files.length} file`, "info");
				let stoppedDuringExecution = false;

				for (let i = 0; i < files.length; i++) {
					// Memeriksa apakah harus berhenti sebelum memproses file berikutnya
					if (shouldStopRef.current) {
						stoppedDuringExecution = true;
						addLog(
							"Tes dihentikan oleh user sebelum memproses semua file",
							"warning"
						);
						break;
					}

					const file = files[i];
					const fileBuffer = await file.arrayBuffer();
					const originalFileSize = fileBuffer.byteLength;
					addLog(
						`Memproses file ${i + 1}/${files.length}: ${file.name}`,
						"info"
					);
					addLog(
						`Ukuran file asli: ${originalFileSize.toLocaleString()} bytes`,
						"info"
					);

					// Mendapatkan metadata dari CSV
					const metadata = metadataMap.get(file.name);

					if (!metadata) {
						const errorMessage = `Tidak ada metadata ditemukan untuk file: ${file.name}`;
						addLog(errorMessage, "error");
						toast.warning(errorMessage);
						testResults.push({
							fileName: file.name,
							signTime: 0,
							verifyTime: 0,
							hash: "",
							signature: "",
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

					const fileNumber = metadata["Nomor Sertifikat"];
					const fileRecipient = metadata.Penerima;
					const fileTitle = metadata.Pencapaian;

					try {
						const fileBytes = new Uint8Array(fileBuffer);

						// Menandatangani dengan pengukuran waktu
						addLog(`Menandatangani ${file.name}...`, "info");
						const { signedPdf, hash, signature, timestamp, signTime } =
							await signDocumentWithTiming(
								fileBytes,
								fileNumber,
								fileRecipient,
								fileTitle,
								position,
								signFunction
							);
						const signedFileSize = signedPdf.length;
						addLog(
							`Tanda tangan selesai: ${file.name} (${signTime.toFixed(6)}s)`,
							"success"
						);
						addLog(`Hash: ${hash}`, "info");
						addLog(`Signature: ${signature.slice(0, 20)}...`, "info");
						addLog(
							`Tanggal: ${new Date(timestamp * 1000).toLocaleString()}`,
							"info"
						);
						addLog(`Nomor Sertifikat: ${fileNumber}`, "info");
						addLog(`Penerima: ${fileRecipient}`, "info");
						addLog(`Pencapaian: ${fileTitle}`, "info");
						addLog(
							`Ukuran file tanda tangan: ${signedFileSize.toLocaleString()} bytes`,
							"info"
						);

						if (shouldStopRef.current) {
							stoppedDuringExecution = true;
							addLog(
								`Tes dihentikan oleh user setelah tanda tangan, sebelum verifikasi ${file.name}`,
								"warning"
							);
							break;
						}

						// Memverifikasi dengan pengukuran waktu
						addLog(`Memverifikasi ${file.name}...`, "info");
						const { isValid, verifyTime } = await verifyDocumentWithTiming(
							signedPdf,
							contract.verifyCertificate.bind(contract)
						);
						addLog(
							`Verifikasi selesai: ${file.name} (${verifyTime.toFixed(6)}s) - ${
								isValid ? "Valid" : "Tidak Valid"
							}`,
							isValid ? "success" : "error"
						);

						const result: TestResult = {
							fileName: file.name,
							signTime,
							verifyTime,
							hash,
							signature,
							number: fileNumber,
							recipient: fileRecipient,
							title: fileTitle,
							timestamp,
							isValid,
							signedPdf,
							originalFileSizeBytes: originalFileSize,
							signedFileSizeBytes: signedFileSize,
						};

						testResults.push(result);
					} catch (err) {
						const errorMessage =
							err instanceof Error ? err.message : "Unknown error";
						addLog(`Error memproses ${file.name}: ${errorMessage}`, "error");
						testResults.push({
							fileName: file.name,
							signTime: 0,
							verifyTime: 0,
							hash: "",
							signature: "",
							number: fileNumber,
							recipient: fileRecipient,
							title: fileTitle,
							timestamp: 0,
							isValid: false,
							error: errorMessage,
							originalFileSizeBytes: originalFileSize,
						});
					}

					setProgress(((i + 1) / files.length) * 100);
					setResults([...testResults]);
				}

				if (shouldStopRef.current || stoppedDuringExecution) {
					addLog(
						`Tes dihentikan oleh user. Total file yang selesai diproses: ${testResults.length}`,
						"warning"
					);
					toast.warning("Tes dihentikan oleh user", {
						description: `Total file yang sempat diproses: ${testResults.length}`,
					});
				} else {
					// Menghitung statistik
					const calculatedStats = calculateStats(testResults);
					setStats(calculatedStats);
					addLog("Perhitungan statistik selesai", "success");
					addLog(
						`Rata-rata waktu tanda tangan: ${calculatedStats.averageSignTime.toFixed(
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
			toast.error("Gagal menjalankan tes", {
				description: errorMessage,
			});
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
		addLog(
			"Permintaan penghentian diterima. Menunggu proses saat ini selesai...",
			"warning"
		);
		toast.warning("Sedang menghentikan tes...");
	};

	const downloadSignCSV = () => {
		if (results.length === 0) return;

		const csvContent = generateSignCSV(results);
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `test-sign-results-${Date.now()}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("CSV operasi tanda tangan berhasil diunduh!");
	};

	const downloadVerifyCSV = () => {
		if (results.length === 0) return;

		const csvContent = generateVerifyCSV(results);
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `test-verify-results-${Date.now()}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("CSV operasi verifikasi berhasil diunduh!");
	};

	const downloadStatsTXT = () => {
		if (!stats) return;

		const txtContent = generateStatsTXT(stats, warmUpCount);
		const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `test-stats-${Date.now()}.txt`;
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
			if (result.signedPdf) {
				zip.file(`signed_${result.fileName}`, result.signedPdf);
			}
		}

		const zipBlob = await zip.generateAsync({ type: "blob" });
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `signed-documents-${Date.now()}.zip`;
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
		// Tidak menghapus private key untuk kemudahan, tapi user bisa menghapus secara manual
		toast.info("Semua data telah dihapus");
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-6xl">
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-2">
					<TestTube className="h-8 w-8" />
					Tests
				</h1>
				<p className="text-lg text-muted-foreground">
					Uji performa tanda tangan dan verifikasi untuk beberapa PDF sekaligus
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
						Masukkan private key untuk signing otomatis tanpa user interaction
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							<strong>PERINGATAN KEAMANAN:</strong> Fitur ini hanya untuk
							lingkungan pengujian (test environment) saja. JANGAN PERNAH
							menggunakan private key dari wallet utama atau wallet yang berisi
							dana yang nyata. Private key akan digunakan untuk signing otomatis
							tanpa konfirmasi. Pastikan Anda menggunakan test wallet dengan
							private key yang aman untuk diungkapkan.
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
								Konfigurasi Tes
							</CardTitle>
							<CardDescription>
								Atur parameter untuk tes tanda tangan dan verifikasi
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Unggah Metadata CSV */}
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
														`File CSV kehilangan header yang diperlukan: ${missingHeaders.join(
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
										// Menghapus state CSV saat tidak ada file yang dipilih
										setCsvFile(null);
										setCsvData([]);
										setCsvError(null);
									}
								}}
								disabled={isProcessing}
								maxFiles={1}
								description='CSV harus berisi header: "Nama File", "Nomor Sertifikat", "Penerima", "Pencapaian". Metadata dari CSV akan digunakan untuk setiap file PDF.'
								required
							/>
							{csvError && (
								<AlertBox variant="destructive" message={csvError} />
							)}

							{/* Posisi Kode QR */}
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

							{/* Sesi Pemanasan */}
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
								description="Jumlah sesi pemanasan sebelum eksekusi tes utama"
								required
							/>

							{/* Unggah File */}
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

							{/* Progres */}
							{isProcessing && (
								<ProgressCard progress={progress} isActive={true} />
							)}

							{/* Tampilan Error */}
							{error && <AlertBox variant="destructive" message={error} />}

							{/* Tombol Aksi */}
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
												label: "Jalankan Tes",
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

					{/* Log Real-time */}
					{signerAddress && !privateKeyError && <LogViewer logs={logs} />}

					{/* Statistik */}
					{stats && (
						<div className="space-y-6">
							{/* Statistik Tanda Tangan */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										<span className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5 text-green-500" />
											Statistik Operasi Tanda Tangan
										</span>
										<div className="flex flex-col sm:flex-row gap-2">
											<Button
												onClick={downloadStatsTXT}
												variant="outline"
												size="sm"
												className="justify-start"
											>
												<FileCode className="mr-2 h-4 w-4" />
												<span className="hidden xs:inline">
													Unduh TXT Stats
												</span>
												<span className="xs:hidden">TXT Stats</span>
											</Button>
											<Button
												onClick={downloadSignCSV}
												variant="outline"
												size="sm"
												className="justify-start"
											>
												<FileSpreadsheet className="mr-2 h-4 w-4" />
												<span className="hidden xs:inline">Unduh CSV Sign</span>
												<span className="xs:hidden">CSV Sign</span>
											</Button>
											<Button
												onClick={downloadSignedPDFs}
												variant="outline"
												size="sm"
												className="justify-start"
											>
												<Download className="mr-2 h-4 w-4" />
												<span className="hidden xs:inline">Unduh PDF(s)</span>
												<span className="xs:hidden">PDF(s)</span>
											</Button>
										</div>
									</CardTitle>
									<CardDescription>
										Ringkasan hasil operasi tanda tangan
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
										</div>
										{stats.signStats.totalFeeETH && (
											<div className="space-y-2">
												<Label className="text-sm font-medium">
													Total Fee (ETH)
												</Label>
												<p className="text-2xl font-bold">
													{stats.signStats.totalFeeETH}
												</p>
											</div>
										)}
										{stats.signStats.averageFeeETH && (
											<div className="space-y-2">
												<Label className="text-sm font-medium">
													Rata-rata Fee (ETH)
												</Label>
												<p className="text-2xl font-bold">
													{stats.signStats.averageFeeETH}
												</p>
											</div>
										)}
									</div>
								</CardContent>
							</Card>

							{/* Statistik Verifikasi */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										<span className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5 text-green-500" />
											Statistik Operasi Verifikasi
										</span>
										<div className="flex gap-2">
											<Button
												onClick={downloadVerifyCSV}
												variant="outline"
												size="sm"
												className="justify-start"
											>
												<FileSpreadsheet className="mr-2 h-4 w-4" />
												<span className="hidden xs:inline">
													Unduh CSV Verify
												</span>
												<span className="xs:hidden">CSV Verify</span>
											</Button>
										</div>
									</CardTitle>
									<CardDescription>
										Ringkasan hasil operasi verifikasi
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
												Rata-rata Waktu Verifikasi (t_verify)
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
							title="Detail Hasil"
							description="Detail hasil dan unduhan per file yang ditandatangani"
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
										label: "Tanda Tangan",
										value: `${result.signature.slice(0, 20)}...`,
										truncate: true,
									},
									{
										label: "Tanggal",
										value:
											result.timestamp > 0
												? new Date(result.timestamp * 1000).toLocaleString()
												: "-",
										truncate: false,
									},
									{
										label: "Nomor Sertifikat",
										value: result.number,
										truncate: true,
									},
									{
										label: "Penerima",
										value: result.recipient,
										truncate: true,
									},
									{ label: "Pencapaian", value: result.title, truncate: true },
									{
										label: "Waktu Tanda Tangan",
										value: `${result.signTime.toFixed(6)}s`,
										truncate: false,
									},
									{
										label: "Waktu Verifikasi",
										value: `${result.verifyTime.toFixed(6)}s`,
										truncate: false,
									},
									...(result.originalFileSizeBytes
										? [
												{
													label: "Ukuran Asli",
													value: `${result.originalFileSizeBytes.toLocaleString()} bytes`,
													truncate: false,
												},
										  ]
										: []),
									...(result.signedFileSizeBytes
										? [
												{
													label: "Ukuran Setelah Tanda Tangan",
													value: `${result.signedFileSizeBytes.toLocaleString()} bytes`,
													truncate: false,
												},
										  ]
										: []),
									...(result.totalFeeETH
										? [
												{
													label: "Fee",
													value: `${result.totalFeeETH} ETH`,
													truncate: false,
												},
										  ]
										: []),
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

export default Tests;
