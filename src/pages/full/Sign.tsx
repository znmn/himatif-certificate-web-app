import React, { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOnchainWallet } from "@/hooks/full/use-wallet";
import {
	signDocumentOnchain,
	Position,
	type PositionType,
} from "@/lib/full/pdf-utils";
import {
	Download,
	FileText,
	Wallet,
	AlertCircle,
	CheckCircle,
	Loader2,
	FilePenLine,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import Papa from "papaparse";
import {
	FileUpload,
	ActionButtons,
	ResultCard,
	ProgressCard,
	FormField,
	AlertBox,
	DropdownSelector,
} from "@/components/web";
import { config } from "@/config";

interface SignedFile {
	id: string;
	originalName: string;
	signedBlob: Blob;
	hash: string;
	txHash: string;
	date: number;
	number: string;
	recipient: string;
	title: string;
	qrUrl: string;
	gasUsed: string;
	totalFeeETH: string;
}

interface CsvMetadata {
	"Nama File": string;
	"Nomor Sertifikat": string;
	Penerima: string;
	Pencapaian: string;
}

const SignOnchain: React.FC = () => {
	const {
		address,
		isConnected,
		isConnecting,
		connect,
		connectors,
		checkSignerStatus,
		signCertificateOnchain,
	} = useOnchainWallet();

	const [isCheckingSigner, setIsCheckingSigner] = useState(false);
	const [isSigner, setIsSigner] = useState(false);
	const [signerInfo, setSignerInfo] = useState<{
		address: string;
		name: string;
	} | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [singleFile, setSingleFile] = useState<File | null>(null);
	const [number, setNumber] = useState("");
	const [recipient, setRecipient] = useState("");
	const [title, setTitle] = useState("");
	const [position, setPosition] = useState<PositionType>(Position.MiddleLeft);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [signedFiles, setSignedFiles] = useState<SignedFile[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [csvFile, setCsvFile] = useState<File | null>(null);
	const [csvData, setCsvData] = useState<CsvMetadata[]>([]);
	const [csvError, setCsvError] = useState<string | null>(null);

	const checkSignerRef = React.useRef<(() => Promise<void>) | null>(null);

	React.useEffect(() => {
		checkSignerRef.current = async () => {
			setIsCheckingSigner(true);
			try {
				const result = await checkSignerStatus();
				setIsSigner(result.isSigner);
				setSignerInfo(result.signerInfo || null);
			} catch (err) {
				setError("Failed to check signer status");
				console.error(err);
			} finally {
				setIsCheckingSigner(false);
			}
		};
	}, [checkSignerStatus]);

	React.useEffect(() => {
		if (isConnected && address) {
			if (checkSignerRef.current) {
				checkSignerRef.current();
			}
		}
	}, [isConnected, address]);

	const processSingleFile = async () => {
		if (!singleFile || !number.trim() || !recipient.trim() || !title.trim()) {
			setError("Harap isi semua field yang wajib diisi dan unggah file");
			return;
		}

		if (!isSigner) {
			setError(
				"Anda tidak diotorisasi untuk menandatangani sertifikat dengan dompet ini"
			);
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		setError(null);

		try {
			const fileBuffer = await singleFile.arrayBuffer();
			const timestamp = Math.floor(Date.now() / 1000);

			const result = await signDocumentOnchain(
				new Uint8Array(fileBuffer),
				number,
				recipient,
				title,
				position,
				async (date, hash, num, rec, ttl) => {
					return signCertificateOnchain(date, hash, num, rec, ttl);
				}
			);

			const signedBlob = new Blob([new Uint8Array(result.signedPdf)], {
				type: "application/pdf",
			});

			const newSignedFile: SignedFile = {
				id: `signed-single-${Date.now()}`,
				originalName: singleFile.name,
				signedBlob,
				hash: result.hash,
				txHash: result.txHash,
				date: timestamp,
				number,
				recipient,
				title,
				qrUrl: result.qrUrl,
				gasUsed: result.gasUsed.toString(),
				totalFeeETH: result.totalFeeETH,
			};

			setSignedFiles([newSignedFile]);
			setProgress(100);

			toast.success("Sertifikat berhasil ditandatangani on-chain!", {
				description: `TX: ${result.txHash.slice(0, 10)}...`,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memproses file");
			toast.error("Gagal menandatangani sertifikat", {
				description: err instanceof Error ? err.message : "Silakan coba lagi",
			});
			console.error(err);
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	const processFilesWithCsv = async () => {
		if (!files.length || !csvData.length) {
			setError("Harap unggah file PDF dan file CSV yang valid");
			return;
		}

		if (!isSigner) {
			setError(
				"Anda tidak diotorisasi untuk menandatangani sertifikat dengan dompet ini"
			);
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		setError(null);
		const newSignedFiles: SignedFile[] = [];

		try {
			const metadataMap = new Map<string, CsvMetadata>();
			csvData.forEach((row) => metadataMap.set(row["Nama File"], row));

			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const metadata = metadataMap.get(file.name);

				if (!metadata) {
					toast.warning(
						`Tidak ada metadata ditemukan untuk file: ${file.name}`
					);
					continue;
				}

				const fileBuffer = await file.arrayBuffer();
				const timestamp = Math.floor(Date.now() / 1000);

				const result = await signDocumentOnchain(
					new Uint8Array(fileBuffer),
					metadata["Nomor Sertifikat"],
					metadata["Penerima"],
					metadata["Pencapaian"],
					position,
					async (date, hash, num, rec, ttl) => {
						return signCertificateOnchain(date, hash, num, rec, ttl);
					}
				);

				const signedBlob = new Blob([new Uint8Array(result.signedPdf)], {
					type: "application/pdf",
				});

				newSignedFiles.push({
					id: `signed-csv-${i}-${Date.now()}`,
					originalName: file.name,
					signedBlob,
					hash: result.hash,
					txHash: result.txHash,
					date: timestamp,
					number: metadata["Nomor Sertifikat"],
					recipient: metadata["Penerima"],
					title: metadata["Pencapaian"],
					qrUrl: result.qrUrl,
					gasUsed: result.gasUsed.toString(),
					totalFeeETH: result.totalFeeETH,
				});

				setProgress(((i + 1) / files.length) * 100);
			}

			setSignedFiles(newSignedFiles);
			toast.success("Sertifikat berhasil ditandatangani on-chain!", {
				description: `${newSignedFiles.length} file telah ditandatangani`,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memproses file");
			toast.error("Gagal menandatangani sertifikat", {
				description: err instanceof Error ? err.message : "Silakan coba lagi",
			});
			console.error(err);
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	const downloadFile = (signedFile: SignedFile) => {
		const url = URL.createObjectURL(signedFile.signedBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `signed_${signedFile.originalName}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("File berhasil diunduh!");
	};

	const downloadAll = async () => {
		const zip = new JSZip();
		signedFiles.forEach((file) =>
			zip.file(`signed_${file.originalName}`, file.signedBlob)
		);
		const zipBlob = await zip.generateAsync({ type: "blob" });
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "signed_documents_onchain.zip";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("Unduhan ZIP selesai!");
	};

	const clearAll = () => {
		setFiles([]);
		setSingleFile(null);
		setNumber("");
		setRecipient("");
		setTitle("");
		setSignedFiles([]);
		setError(null);
		setProgress(0);
		setCsvFile(null);
		setCsvData([]);
		setCsvError(null);
		toast.info("Semua data telah dihapus");
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4">
					Tandatangani Sertifikat (Full Onchain)
				</h1>
				<p className="text-lg text-muted-foreground">
					Tandatangani sertifikat PDF dengan data tersimpan sepenuhnya di
					blockchain
				</p>
			</div>

			{/* Koneksi Dompet */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Wallet className="h-5 w-5" />
						Koneksi Dompet
					</CardTitle>
					<CardDescription>
						Sambungkan dompet Anda untuk menandatangani sertifikat on-chain
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!isConnected ? (
						<div className="space-y-4">
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									Sambungkan dompet Anda untuk mengakses fitur penandatanganan
									on-chain.
								</AlertDescription>
							</Alert>
							<div className="flex flex-wrap gap-2">
								{connectors.map((connector) => (
									<div key={connector.id} className="flex-1 min-w-[150px]">
										<Button
											onClick={() => connect({ connector })}
											disabled={isConnecting}
											className="w-full"
										>
											{isConnecting ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Wallet className="mr-2 h-4 w-4" />
											)}
											Connect {connector.name}
										</Button>
									</div>
								))}
							</div>
						</div>
					) : (
						<div className="space-y-4">
							<div className="flex flex-wrap items-center gap-2 break-all">
								<CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
								<span className="font-medium shrink-0">Terhubung:</span>
								<code className="text-sm bg-muted px-2 py-1 rounded break-all">
									{address}
								</code>
							</div>

							{isCheckingSigner ? (
								<div className="flex items-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									<span>Memeriksa status penandatangan...</span>
								</div>
							) : isSigner ? (
								<Alert>
									<CheckCircle className="h-4 w-4" />
									<AlertDescription>
										✅ Penandatangan yang diotorisasi: {signerInfo?.name}
									</AlertDescription>
								</Alert>
							) : (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>
										❌ Anda tidak diotorisasi untuk menandatangani sertifikat
										dengan dompet ini.
									</AlertDescription>
								</Alert>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{isConnected && isSigner && (
				<Tabs defaultValue="single" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="single">Sertifikat Tunggal</TabsTrigger>
						<TabsTrigger value="multiple">Beberapa Sertifikat</TabsTrigger>
					</TabsList>

					<TabsContent value="single">
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Penandatanganan Sertifikat Tunggal
								</CardTitle>
								<CardDescription>
									Unggah dan tandatangani satu sertifikat PDF on-chain
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<FormField
										id="number"
										label="Nomor Sertifikat"
										type="text"
										value={number}
										onChange={setNumber}
										placeholder="contoh: CERT-2025-001"
										required
									/>
									<FormField
										id="recipient"
										label="Nama Penerima"
										type="text"
										value={recipient}
										onChange={setRecipient}
										placeholder="contoh: Zainul Muhaimin"
										required
									/>
								</div>
								<FormField
									id="title"
									label="Pencapaian"
									type="text"
									value={title}
									onChange={setTitle}
									placeholder="contoh: Master - Debugging - 2025"
									required
								/>

								<DropdownSelector
									id="qr-position-single"
									label="Posisi Kode QR"
									value={position}
									onValueChange={setPosition}
									options={Object.values(Position)}
									menuLabel="Posisi Kode QR"
									required
								/>

								<FileUpload
									id="single-file-upload"
									label="Unggah File PDF"
									accept=".pdf"
									files={singleFile ? [singleFile] : []}
									onChange={(files) => setSingleFile(files[0] || null)}
									maxFiles={1}
									required
								/>

								{error && <AlertBox variant="destructive" message={error} />}
								{isProcessing && (
									<ProgressCard progress={progress} isActive={true} />
								)}

								<ActionButtons
									buttons={[
										{
											id: "sign-single",
											label: "Tandatangani On-Chain",
											onClick: processSingleFile,
											disabled:
												isProcessing ||
												!singleFile ||
												!number.trim() ||
												!recipient.trim() ||
												!title.trim(),
											loading: isProcessing,
											icon: <FilePenLine className="h-4 w-4" />,
											className: "flex-1",
										},
										{
											id: "clear-all",
											label: "Hapus Semua",
											onClick: clearAll,
											variant: "destructive",
										},
									]}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="multiple">
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Penandatanganan Beberapa Sertifikat
								</CardTitle>
								<CardDescription>
									Unggah beberapa file PDF dan metadata CSV untuk
									penandatanganan on-chain
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<DropdownSelector
									id="qr-position-multiple"
									label="Posisi Kode QR"
									value={position}
									onValueChange={setPosition}
									options={Object.values(Position)}
									menuLabel="Posisi Kode QR"
									required
								/>

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
											Papa.parse<CsvMetadata>(file, {
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
												},
												error: (error) => {
													setCsvError(
														`Gagal menguraikan CSV: ${error.message}`
													);
													setCsvData([]);
												},
											});
										} else {
											setCsvFile(null);
											setCsvData([]);
											setCsvError(null);
										}
									}}
									maxFiles={1}
									description='CSV harus berisi header: "Nama File", "Nomor Sertifikat", "Penerima", "Pencapaian"'
									required
								/>

								<FileUpload
									id="multiple-file-upload"
									label="Unggah File PDF"
									accept=".pdf"
									multiple={true}
									files={files}
									onChange={setFiles}
									required
								/>

								{csvError && (
									<AlertBox variant="destructive" message={csvError} />
								)}
								{error && <AlertBox variant="destructive" message={error} />}
								{isProcessing && (
									<ProgressCard progress={progress} isActive={true} />
								)}

								<ActionButtons
									buttons={[
										{
											id: "sign-multiple",
											label: "Tandatangani On-Chain",
											onClick: processFilesWithCsv,
											disabled:
												isProcessing ||
												!files.length ||
												!csvData.length ||
												!!csvError,
											loading: isProcessing,
											icon: <FilePenLine className="h-4 w-4" />,
											className: "flex-1",
										},
										{
											id: "clear-all-multiple",
											label: "Hapus Semua",
											onClick: clearAll,
											variant: "destructive",
										},
									]}
								/>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			)}

			{signedFiles.length > 0 && (
				<ResultCard
					title="Sertifikat yang Ditandatangani (On-Chain)"
					description="Sertifikat yang ditandatangani Anda siap untuk diunduh"
					items={signedFiles.map((file) => ({
						id: file.id,
						title: file.originalName,
						status: "success",
						badge: "On-Chain",
						details: [
							{ label: "Hash", value: file.hash, truncate: true },
							{
								label: "TX Hash",
								value: file.txHash,
								truncate: true,
								link: `${config.BLOCK_EXPLORER_URL}/tx/${file.txHash}`,
							},
							{
								label: "Tanggal",
								value: new Date(file.date * 1000).toLocaleString(),
							},
							{ label: "Nomor Sertifikat", value: file.number, truncate: true },
							{ label: "Penerima", value: file.recipient, truncate: true },
							{ label: "Pencapaian", value: file.title, truncate: true },
							{ label: "Gas Used", value: file.gasUsed },
							{ label: "Fee", value: `${file.totalFeeETH} ETH` },
						],
						url: { label: "URL Verifikasi", value: file.qrUrl },
						downloadable: true,
						onDownload: () => downloadFile(file),
					}))}
					headerActions={
						<Button
							onClick={downloadAll}
							variant="outline"
							className="whitespace-nowrap px-2 sm:px-4 text-xs sm:text-sm"
						>
							<Download className="mr-2 h-4 w-4" />
							<span>Unduh ZIP</span>
						</Button>
					}
				/>
			)}
		</div>
	);
};

export default SignOnchain;
