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
	OnchainVerificationContract,
	type OnchainContractInfo,
	type OnchainVerificationResult,
} from "@/lib/full/contract";
import { verifyDocumentOnchain } from "@/lib/full/pdf-utils";
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

interface VerificationResultItem {
	id: string;
	source: "qr" | "pdf";
	fileName?: string;
	verification: OnchainVerificationResult;
	recalculatedHash: string;
}

const VerifyOnchain: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verificationResults, setVerificationResults] = useState<
		VerificationResultItem[]
	>([]);
	const [error, setError] = useState<string | null>(null);
	const [contractInfo, setContractInfo] = useState<OnchainContractInfo | null>(
		null
	);
	const [isLoadingContract, setIsLoadingContract] = useState(true);

	const verifyFromUrlParams = React.useCallback(
		async (hash: string) => {
			setIsVerifying(true);
			setError(null);
			setVerificationResults([]);

			try {
				const contract = OnchainVerificationContract.getInstance();
				const result = await contract.verifyCertificate(hash);

				setVerificationResults([
					{
						id: "qr",
						source: "qr",
						verification: result,
						recalculatedHash: hash,
					},
				]);

				if (result.isValid) {
					toast.success("Verifikasi kode QR berhasil!", {
						description: "Sertifikat terverifikasi dari blockchain",
					});
				} else {
					toast.error("Verifikasi kode QR gagal", {
						description: "Hash tidak ditemukan di blockchain",
					});
				}

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
		const hash = searchParams.get("hash");

		if (!hash) return;

		if (!hash.startsWith("0x") || hash.length !== 66) {
			setError("Format hash tidak valid di URL");
			return;
		}

		verifyFromUrlParams(hash);
	}, [searchParams, verifyFromUrlParams]);

	useEffect(() => {
		loadContractInfo();
		checkUrlParams();
	}, [checkUrlParams]);

	const loadContractInfo = async () => {
		setIsLoadingContract(true);
		try {
			const contract = OnchainVerificationContract.getInstance();
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
			const contract = OnchainVerificationContract.getInstance();
			const newResults: VerificationResultItem[] = [];
			let successCount = 0;
			let failureCount = 0;
			let firstErrorMessage: string | null = null;

			for (const file of uploadedFiles) {
				try {
					const fileBuffer = await file.arrayBuffer();
					const fileBytes = new Uint8Array(fileBuffer);

					const result = await verifyDocumentOnchain(
						fileBytes,
						contract.verifyCertificate.bind(contract)
					);

					newResults.push({
						id: `pdf-${file.name}-${Date.now()}-${Math.random()}`,
						source: "pdf",
						fileName: file.name,
						verification: {
							isValid: result.isValid,
							date: result.date,
							number: result.number,
							recipient: result.recipient,
							title: result.title,
							signer: result.signer,
							signerNameAtTime: result.signerNameAtTime,
						},
						recalculatedHash: result.recalculatedHash,
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
					if (!firstErrorMessage) firstErrorMessage = message;
					console.error(err);
					newResults.push({
						id: `pdf-${file.name}-${Date.now()}-${Math.random()}`,
						source: "pdf",
						fileName: file.name,
						verification: {
							isValid: false,
							date: 0,
							number: "",
							recipient: "",
							title: "",
							signer: "",
							signerNameAtTime: "",
						},
						recalculatedHash: "",
					});
				}
			}

			if (newResults.length > 0) {
				setVerificationResults(newResults);
			}

			if (failureCount === 0) {
				toast.success("Verifikasi selesai", {
					description: `${successCount} file berhasil diverifikasi.`,
				});
			} else if (successCount > 0) {
				toast.warning("Verifikasi selesai dengan beberapa kegagalan", {
					description: `${successCount} file berhasil, ${failureCount} file gagal.`,
				});
				if (firstErrorMessage) setError(firstErrorMessage);
			} else {
				toast.error("Semua verifikasi gagal", {
					description:
						firstErrorMessage || "Tidak ada file yang berhasil diverifikasi.",
				});
				if (firstErrorMessage) setError(firstErrorMessage);
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
			"Hash",
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
			const { source, fileName, verification, recalculatedHash } = result;
			const dateStr =
				verification.date > 0
					? new Date(verification.date * 1000).toISOString()
					: "";
			const status = verification.isValid ? "VALID" : "TIDAK VALID";

			return [
				index + 1,
				source === "qr" ? "QR" : "PDF",
				fileName || "",
				recalculatedHash,
				verification.number,
				verification.recipient,
				verification.title,
				dateStr,
				status,
				verification.signer,
				verification.signerNameAtTime || "",
			]
				.map(escapeCsv)
				.join(",");
		});

		const csvContent = [header, ...rows].join("\r\n");
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "verification_results_onchain.csv";
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
		toast.info("Data verifikasi telah dihapus");
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4">
					Verifikasi Sertifikat (Full Onchain)
				</h1>
				<p className="text-lg text-muted-foreground">
					Verifikasi sertifikat dengan data yang tersimpan sepenuhnya di
					blockchain
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
							Informasi Kontrak (Full Onchain)
						</CardTitle>
						<CardDescription>
							Detail kontrak verifikasi on-chain
						</CardDescription>
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
										{config.FULL_CONTRACT_ADDRESS}
									</code>
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											window.open(
												`${config.BLOCK_EXPLORER_URL}/address/${config.FULL_CONTRACT_ADDRESS}#code`,
												"_blank"
											)
										}
									>
										<ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<div>
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
							keasliannya dari blockchain
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
							description="Unggah sertifikat PDF yang berisi QR code verifikasi"
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
									Hasil Verifikasi (On-Chain)
								</CardTitle>
								<CardDescription>
									Detail verifikasi sertifikat dari blockchain
								</CardDescription>
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
										<span className="hidden xs:inline">Hapus Hasil</span>
										<span className="xs:hidden">Hapus</span>
									</Button>
								</div>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<Alert
							variant={
								verificationResults.every((r) => r.verification.isValid)
									? "default"
									: "destructive"
							}
						>
							<AlertDescription>
								<div className="space-y-4 w-full">
									{verificationResults.map(
										({
											id,
											source,
											fileName,
											verification,
											recalculatedHash,
										}) => (
											<div
												key={id}
												className="space-y-3 border rounded-md p-3 bg-background"
											>
												<div className="flex items-center gap-2">
													{verification.isValid ? (
														<CheckCircle className="h-5 w-5 text-green-500" />
													) : (
														<AlertCircle className="h-5 w-5 text-red-500" />
													)}
													<span className="font-semibold">
														{verification.isValid
															? "Sertifikat VALID (On-Chain)"
															: "Sertifikat TIDAK VALID"}
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
														<span className="font-medium">Hash:</span>
														<code className="text-xs bg-muted px-1 py-0.5 rounded">
															{recalculatedHash.slice(0, 10)}...
															{recalculatedHash.slice(-8)}
														</code>
													</div>
													{verification.isValid && (
														<>
															<div className="flex justify-between">
																<span className="font-medium">
																	Nomor Sertifikat:
																</span>
																<span>{verification.number}</span>
															</div>
															<div className="flex justify-between">
																<span className="font-medium">Penerima:</span>
																<span>{verification.recipient}</span>
															</div>
															<div className="flex justify-between">
																<span className="font-medium">Pencapaian:</span>
																<span>{verification.title}</span>
															</div>
															<div className="flex justify-between">
																<span className="font-medium">
																	Tanggal Ditandatangani:
																</span>
																<span>
																	{new Date(
																		verification.date * 1000
																	).toLocaleString()}
																</span>
															</div>
															<div className="flex justify-between">
																<span className="font-medium">
																	Alamat Penandatangan:
																</span>
																<button
																	onClick={() =>
																		window.open(
																			`${config.BLOCK_EXPLORER_URL}/address/${verification.signer}`,
																			"_blank"
																		)
																	}
																	className="group"
																	type="button"
																	title="Lihat di Explorer"
																>
																	<code className="text-xs bg-muted px-1 py-0.5 rounded">
																		{verification.signer.slice(0, 6)}...
																		{verification.signer.slice(-4)}
																	</code>
																</button>
															</div>
															{verification.signerNameAtTime && (
																<div className="flex justify-between">
																	<span className="font-medium">
																		Nama Penandatangan:
																	</span>
																	<span>{verification.signerNameAtTime}</span>
																</div>
															)}
														</>
													)}
												</div>

												<Separator />

												<div className="text-sm">
													{verification.isValid ? (
														<p className="text-green-700">
															✅ Sertifikat ini telah diverifikasi dari
															blockchain dan valid. Data sertifikat tersimpan
															sepenuhnya on-chain.
														</p>
													) : (
														<p className="text-red-700">
															❌ Verifikasi sertifikat gagal. Hash tidak
															ditemukan di blockchain atau sertifikat telah
															diubah.
														</p>
													)}
												</div>
											</div>
										)
									)}
								</div>
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			)}
		</div>
	);
};

export default VerifyOnchain;
