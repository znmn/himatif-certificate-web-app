import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Separator } from "@/components/ui/separator";
import {
	VerificationContract,
	type ContractInfo,
	type VerificationResult,
} from "@/lib/contract";
import { verifyDocument, type ExtractedData } from "@/lib/pdf-utils";

import {
	ShieldCheck,
	AlertCircle,
	CheckCircle,
	ExternalLink,
	FileText,
	FileSpreadsheet,
	Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { config } from "@/config";
import {
	FileUpload,
	ActionButtons,
	AlertBox,
	CardLoader,
} from "@/components/web";

const Verify: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verificationResults, setVerificationResults] = useState<
		{
			id: string;
			source: "qr" | "pdf";
			fileName?: string;
			verification: VerificationResult;
			extractedData: ExtractedData;
		}[]
	>([]);
	const [error, setError] = useState<string | null>(null);
	const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
	const [isLoadingContract, setIsLoadingContract] = useState(true);

	const verifyFromUrlParams = React.useCallback(
		async (
			signature: string,
			dateStr: string,
			hash: string,
			number: string,
			recipient: string,
			title: string
		) => {
			setIsVerifying(true);
			setError(null);
			setVerificationResults([]);

			try {
				const contract = VerificationContract.getInstance();
				const timestamp = parseInt(dateStr, 10);

				const result = await contract.verifyCertificate(
					timestamp,
					hash,
					decodeURIComponent(number),
					decodeURIComponent(recipient),
					decodeURIComponent(title),
					signature
				);

				const extracted: ExtractedData = {
					date: timestamp,
					signature,
					number: decodeURIComponent(number),
					recipient: decodeURIComponent(recipient),
					title: decodeURIComponent(title),
				};

				setVerificationResults([
					{
						id: "qr",
						source: "qr",
						verification: result,
						extractedData: extracted,
					},
				]);

				if (result.isValid) {
					toast.success("Verifikasi kode QR berhasil!", {
						description:
							"Tanda tangan sertifikat terverifikasi dari data kode QR",
					});
				} else {
					toast.error("Verifikasi kode QR gagal", {
						description:
							"Data kode QR tidak cocok dengan tanda tangan yang valid",
					});
				}

				// Menghapus parameter pencarian dari URL setelah verifikasi berhasil
				setSearchParams({}, { replace: true });
			} catch (err) {
				setError(err instanceof Error ? err.message : "Verifikasi gagal");
				toast.error("Verifikasi kode QR gagal", {
					description:
						err instanceof Error ? err.message : "Data kode QR tidak valid",
				});
				console.error(err);
			} finally {
				setIsVerifying(false);
			}
		},
		[setSearchParams]
	);

	const checkUrlParams = React.useCallback(() => {
		const signature = searchParams.get("signature");
		const date = searchParams.get("date");
		const hash = searchParams.get("hash");
		const number = searchParams.get("number");
		const recipient = searchParams.get("recipient");
		const title = searchParams.get("title");

		// Memvalidasi semua parameter yang diperlukan ada
		if (!signature || !date || !hash || !number || !recipient || !title) {
			return;
		}

		// Validasi dasar
		if (!signature.startsWith("0x") || signature.length !== 132) {
			setError("Format tanda tangan tidak valid di URL");
			return;
		}

		if (!hash.startsWith("0x") || hash.length !== 66) {
			setError("Format hash tidak valid di URL");
			return;
		}

		const timestamp = parseInt(date, 10);
		if (isNaN(timestamp) || timestamp <= 0) {
			setError("Format tanggal tidak valid di URL");
			return;
		}

		// Verifikasi otomatis dari parameter URL (kode QR)
		verifyFromUrlParams(signature, date, hash, number, recipient, title);
	}, [searchParams, verifyFromUrlParams]);

	// Memuat info kontrak saat mount dan memantau perubahan parameter URL
	useEffect(() => {
		loadContractInfo();
		checkUrlParams();
	}, [checkUrlParams]);

	const loadContractInfo = async () => {
		setIsLoadingContract(true);
		try {
			const contract = VerificationContract.getInstance();
			const info = await contract.getContractInfo();
			setContractInfo(info);
		} catch (err) {
			console.error("Failed to load contract info:", err);
		} finally {
			setIsLoadingContract(false);
		}
	};

	const verifyUploadedFiles = async () => {
		if (uploadedFiles.length === 0) {
			setError("Silakan unggah setidaknya satu file PDF terlebih dahulu");
			return;
		}

		setIsVerifying(true);
		setError(null);

		try {
			const contract = VerificationContract.getInstance();
			const newResults: {
				id: string;
				source: "pdf";
				fileName?: string;
				verification: VerificationResult;
				extractedData: ExtractedData;
			}[] = [];
			let successCount = 0;
			let failureCount = 0;
			let firstErrorMessage: string | null = null;

			for (const file of uploadedFiles) {
				try {
					const fileBuffer = await file.arrayBuffer();
					const fileBytes = new Uint8Array(fileBuffer);

					const result = await verifyDocument(
						fileBytes,
						contract.verifyCertificate.bind(contract)
					);

					if (!result.extractedData) {
						throw new Error(
							`Tidak dapat mengekstrak data dari PDF: ${file.name}`
						);
					}

					newResults.push({
						id: `pdf-${file.name}-${Date.now()}-${Math.random()}`,
						source: "pdf",
						fileName: file.name,
						verification: {
							isValid: result.isValid,
							recoveredSigner: result.recoveredSigner,
							signerNameAtTime: result.signerNameAtTime,
						},
						extractedData: result.extractedData,
					});

					if (result.isValid) {
						successCount += 1;
					} else {
						failureCount += 1;
					}
				} catch (err) {
					failureCount += 1;
					const message =
						err instanceof Error ? err.message : "Verifikasi gagal";
					if (!firstErrorMessage) {
						firstErrorMessage = message;
					}
					console.error(err);

					// Menambahkan entri hasil gagal agar file tetap muncul di hasil
					newResults.push({
						id: `pdf-${file.name}-${Date.now()}-${Math.random()}`,
						source: "pdf",
						fileName: file.name,
						verification: {
							isValid: false,
							recoveredSigner: "",
							signerNameAtTime: "",
						},
						extractedData: {
							date: 0,
							signature: "",
							number: "",
							recipient: "",
							title: "",
						},
					});
				}
			}

			if (newResults.length > 0) {
				// setVerificationResults((prev) => [
				// 	// Simpan hasil verifikasi QR yang sudah ada
				// 	...prev.filter((r) => r.source === "qr"),
				// 	// Ganti hasil verifikasi PDF sebelumnya dengan yang baru
				// 	...newResults,
				// ]);
				setVerificationResults(newResults);
			}

			// Menampilkan toast ringkasan setelah semua file diproses
			if (failureCount === 0) {
				toast.success("Verifikasi selesai", {
					description: `${successCount} file berhasil diverifikasi.`,
				});
			} else if (successCount > 0) {
				toast.warning("Verifikasi selesai dengan beberapa kegagalan", {
					description: `${successCount} file berhasil, ${failureCount} file gagal diverifikasi.`,
				});
				if (firstErrorMessage) {
					setError(firstErrorMessage);
				}
			} else {
				toast.error("Semua verifikasi gagal", {
					description:
						firstErrorMessage || "Tidak ada file yang berhasil diverifikasi.",
				});
				if (firstErrorMessage) {
					setError(firstErrorMessage);
				}
			}
		} finally {
			setIsVerifying(false);
		}
	};

	const downloadResultsCsv = () => {
		if (verificationResults.length === 0) {
			toast.error("Tidak ada hasil verifikasi untuk diunduh");
			return;
		}

		const header = [
			"No",
			"Sumber",
			"Nama File",
			"Nomor Sertifikat",
			"Penerima",
			"Pencapaian",
			"Tanggal Ditandatangani",
			"Status",
			"Alamat Penandatangan",
			"Nama Penandatangan",
		].join(",");

		const escapeCsv = (value: string | number | boolean | null | undefined) => {
			const str = String(value ?? "");
			const escaped = str.replace(/"/g, '""');
			return `"${escaped}"`;
		};

		const rows = verificationResults.map((result, index) => {
			const { source, fileName, verification, extractedData } = result;
			const dateStr = new Date(extractedData.date * 1000).toISOString();
			const status = verification.isValid ? "VALID" : "TIDAK VALID";

			return [
				index + 1,
				source === "qr" ? "QR" : "PDF",
				fileName || "",
				extractedData.number,
				extractedData.recipient,
				extractedData.title,
				dateStr,
				status,
				verification.recoveredSigner,
				verification.signerNameAtTime || "",
			]
				.map(escapeCsv)
				.join(",");
		});

		const csvContent = [header, ...rows].join("\r\n");
		const blob = new Blob([csvContent], {
			type: "text/csv;charset=utf-8;",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "verification_results.csv";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		toast.success("CSV hasil verifikasi berhasil diunduh");
	};

	const resetVerification = () => {
		setUploadedFiles([]);
		setVerificationResults([]);
		setError(null);
		toast.info("Data verifikasi telah dihapus", {
			description:
				"Semua hasil verifikasi dan file yang diunggah telah direset",
		});
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4">Verifikasi Sertifikat</h1>
				<p className="text-lg text-muted-foreground">
					Unggah PDF yang ditandatangani atau pindai kode QR untuk memverifikasi
					tanda tangan sertifikat
				</p>
			</div>

			{/* Informasi Kontrak */}
			{isLoadingContract ? (
				<CardLoader />
			) : contractInfo ? (
				<Card className="mb-6">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5" />
							Informasi Kontrak
						</CardTitle>
						<CardDescription>Detail kontrak verifikasi</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label className="text-sm font-medium">Nama Aplikasi</Label>
								<p className="text-sm mt-1">{contractInfo.appName}</p>
							</div>
							<div>
								<Label className="text-sm font-medium">
									Nama Penandatangan
								</Label>
								<p className="text-sm mt-1">{contractInfo.signerName}</p>
							</div>
							<div className="min-w-0">
								<Label className="text-sm font-medium">Alamat Kontrak</Label>
								<div className="flex items-center gap-2 mt-1 min-w-0">
									<code className="text-sm bg-muted px-2 py-1 rounded flex-1 overflow-x-auto whitespace-nowrap break-all min-w-0">
										{config.HYBRID_CONTRACT_ADDRESS}
									</code>
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											window.open(
												`${config.BLOCK_EXPLORER_URL}/address/${config.HYBRID_CONTRACT_ADDRESS}#code`,
												"_blank"
											)
										}
									>
										<ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<div>
								{/* <Label className="text-sm font-medium">Version</Label>
								<Badge variant="secondary">{contractInfo.version}</Badge> */}
								<Label className="text-sm font-medium">
									Alamat Penandatangan
								</Label>
								<div className="flex items-center gap-2 mt-1 min-w-0">
									<code className="text-sm bg-muted px-2 py-1 rounded flex-1 overflow-x-auto whitespace-nowrap break-all min-w-0">
										{contractInfo.signerAddress}
									</code>
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											window.open(
												`${config.BLOCK_EXPLORER_URL}/address/${contractInfo.signerAddress}`,
												"_blank"
											)
										}
									>
										<ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			) : null}

			{/* Unggah File */}
			{contractInfo && (
				<Card className="mb-6">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Verifikasi Sertifikat
						</CardTitle>
						<CardDescription>
							Unggah sertifikat PDF yang ditandatangani untuk memverifikasi
							keasliannya
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<FileUpload
							id="pdf-upload"
							label="Unggah PDF yang Ditandatangani"
							accept=".pdf"
							multiple={true}
							files={uploadedFiles}
							onChange={setUploadedFiles}
							description="Unggah sertifikat PDF yang berisi data tanda tangan yang tertanam"
							required
						/>

						<ActionButtons
							buttons={[
								{
									id: "verify-files",
									label: "Verifikasi",
									onClick: verifyUploadedFiles,
									disabled: isVerifying || uploadedFiles.length === 0,
									loading: isVerifying,
									icon: <ShieldCheck className="h-4 w-4" />,
									className: "flex-1",
								},
								{
									id: "reset-verification",
									label: "Hapus Semua",
									onClick: resetVerification,
									variant: "destructive",
									disabled: isVerifying,
								},
							]}
						/>

						{error && <AlertBox variant="destructive" message={error} />}
					</CardContent>
				</Card>
			)}

			{/* Hasil Verifikasi */}
			{verificationResults.length > 0 && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									{verificationResults.every((r) => r.verification.isValid) ? (
										<CheckCircle className="h-5 w-5 text-green-500" />
									) : (
										<AlertCircle className="h-5 w-5 text-red-500" />
									)}
									Hasil Verifikasi
								</CardTitle>
								<CardDescription>Detail verifikasi sertifikat</CardDescription>
							</div>
							{!isVerifying && (
								<div className="flex flex-col sm:flex-row gap-2">
									<Button
										variant="outline"
										onClick={downloadResultsCsv}
										className="justify-start"
									>
										<FileSpreadsheet className="mr-2 h-4 w-4" />
										<span className="hidden xs:inline">Unduh CSV</span>
										<span className="xs:hidden">CSV</span>
									</Button>
									<Button
										variant="destructive"
										onClick={resetVerification}
										className="justify-start"
									>
										<Trash2 className="mr-2 h-4 w-4" />
										<span className="hidden xs:inline">
											Hapus Hasil Verifikasi
										</span>
										<span className="xs:hidden">Hapus</span>
									</Button>
								</div>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-4 w-full">
							{verificationResults.map(
								({ id, source, fileName, verification, extractedData }) => (
									<Alert
										key={id}
										variant={verification.isValid ? "default" : "destructive"}
									>
										<AlertDescription>
											<div className="space-y-3 w-full">
												<div className="flex items-center gap-2">
													{verification.isValid ? (
														<CheckCircle className="h-5 w-5 text-green-500" />
													) : (
														<AlertCircle className="h-5 w-5 text-red-500" />
													)}
													<span className="font-semibold">
														{verification.isValid
															? "Tanda Tangan Sertifikat VALID"
															: "Tanda Tangan Sertifikat TIDAK VALID"}
													</span>
													<span className="text-xs text-muted-foreground ml-auto">
														{source === "qr"
															? "Sumber: Kode QR"
															: fileName
															? `File: ${fileName}`
															: "Sumber: PDF"}
													</span>
												</div>

												<Separator />

												<div className="space-y-2 text-sm">
													<div className="flex justify-between">
														<span className="font-medium">
															Nomor Sertifikat:
														</span>
														<span>{extractedData.number}</span>
													</div>
													<div className="flex justify-between">
														<span className="font-medium">Penerima:</span>
														<span>{extractedData.recipient}</span>
													</div>
													<div className="flex justify-between">
														<span className="font-medium">Pencapaian:</span>
														<span>{extractedData.title}</span>
													</div>
													<div className="flex justify-between">
														<span className="font-medium">
															Tanggal Ditandatangani:
														</span>
														<span>
															{new Date(
																extractedData.date * 1000
															).toLocaleString()}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="font-medium">
															Alamat Penandatangan:
														</span>
														<div className="flex items-center gap-2">
															<button
																onClick={() =>
																	window.open(
																		`${config.BLOCK_EXPLORER_URL}/address/${verification.recoveredSigner}`,
																		"_blank"
																	)
																}
																className="group"
																type="button"
																title="Lihat di Explorer"
																style={{ outline: "none" }}
															>
																<code className="text-xs bg-muted px-1 py-0.5 rounded">
																	{verification.recoveredSigner.slice(0, 6)}
																	...
																	{verification.recoveredSigner.slice(-4)}
																</code>
															</button>
														</div>
													</div>
													{verification.signerNameAtTime && (
														<div className="flex justify-between">
															<span className="font-medium">
																Nama Penandatangan:
															</span>
															<span>{verification.signerNameAtTime}</span>
														</div>
													)}
												</div>

												<Separator />

												<div className="text-sm">
													{verification.isValid ? (
														<p className="text-green-700">
															✅ Sertifikat ini telah diverifikasi di blockchain
															dan valid. Tanda tangan cocok dengan penandatangan
															yang terdaftar dan hash sertifikat valid.
														</p>
													) : (
														<p className="text-red-700">
															❌ Verifikasi sertifikat gagal. Ini bisa berarti:
															<br />• Tanda tangan tidak valid
															<br />• Sertifikat telah diubah
															<br />• Penandatangan tidak diotorisasi
															<br />• Format sertifikat rusak
														</p>
													)}
												</div>
											</div>
										</AlertDescription>
									</Alert>
								)
							)}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};

export default Verify;
