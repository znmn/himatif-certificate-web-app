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
import { useWallet } from "@/hooks/use-wallet";
import { signDocument, Position, type PositionType } from "@/lib/pdf-utils";
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

interface SignedFile {
	id: string;
	originalName: string;
	signedBlob: Blob;
	hash: string;
	signature: string;
	date: number;
	number: string;
	recipient: string;
	title: string;
	qrUrl: string;
}

interface CsvMetadata {
	"Nama File": string;
	"Nomor Sertifikat": string;
	Penerima: string;
	Pencapaian: string;
}

const Sign: React.FC = () => {
	const {
		address,
		isConnected,
		isConnecting,
		connect,
		connectors,
		checkSignerStatus,
		signCertificate,
	} = useWallet();

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

	// Memperbarui ref dengan fungsi checkSigner terbaru
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

	// Memeriksa status penandatangan saat dompet terhubung
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

			const {
				signedPdf,
				hash: fileHash,
				signature,
				qrUrl,
				timestamp,
			} = await signDocument(
				new Uint8Array(fileBuffer),
				number,
				recipient,
				title,
				position,
				signCertificate
			);

			const signedBlob = new Blob([new Uint8Array(signedPdf)], {
				type: "application/pdf",
			});

			const newSignedFile: SignedFile = {
				id: `signed-single-${Date.now()}`,
				originalName: singleFile.name,
				signedBlob,
				hash: fileHash,
				signature,
				date: timestamp,
				number,
				recipient,
				title,
				qrUrl,
			};

			setSignedFiles([newSignedFile]);
			setProgress(100);

			toast.success("Sertifikat berhasil ditandatangani!", {
				description: "File telah ditandatangani secara kriptografi",
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
			// Membuat map nama file ke metadata untuk pencarian cepat
			const metadataMap = new Map<string, CsvMetadata>();
			csvData.forEach((row) => {
				metadataMap.set(row["Nama File"], row);
			});

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

				const {
					signedPdf,
					hash: fileHash,
					signature,
					qrUrl,
					timestamp,
				} = await signDocument(
					new Uint8Array(fileBuffer),
					metadata["Nomor Sertifikat"],
					metadata["Penerima"],
					metadata["Pencapaian"],
					position,
					signCertificate
				);

				const signedBlob = new Blob([new Uint8Array(signedPdf)], {
					type: "application/pdf",
				});

				newSignedFiles.push({
					id: `signed-csv-${i}-${Date.now()}`,
					originalName: file.name,
					signedBlob,
					hash: fileHash,
					signature,
					date: timestamp,
					number: metadata["Nomor Sertifikat"],
					recipient: metadata["Penerima"],
					title: metadata["Pencapaian"],
					qrUrl,
				});

				setProgress(((i + 1) / files.length) * 100);
			}

			setSignedFiles(newSignedFiles);
			toast.success("Sertifikat berhasil ditandatangani!", {
				description: `${newSignedFiles.length} file telah ditandatangani secara kriptografi menggunakan metadata CSV`,
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
		toast.success("File berhasil diunduh!", {
			description: `signed_${signedFile.originalName} telah disimpan ke perangkat Anda`,
		});
	};

	const downloadAll = async () => {
		const zip = new JSZip();

		signedFiles.forEach((file) => {
			zip.file(`signed_${file.originalName}`, file.signedBlob);
		});

		const zipBlob = await zip.generateAsync({ type: "blob" });
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "signed_documents.zip";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("Unduhan ZIP selesai!", {
			description:
				"Semua sertifikat yang ditandatangani telah diunduh sebagai signed_documents.zip",
		});
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
		toast.info("Semua data telah dihapus", {
			description: "File, tanda tangan, dan data formulir telah direset",
		});
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4">Tandatangani Sertifikat</h1>
				<p className="text-lg text-muted-foreground">
					Sambungkan dompet Anda dan tandatangani sertifikat PDF dengan
					verifikasi kriptografi
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
						Sambungkan dompet Anda untuk menandatangani sertifikat
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!isConnected ? (
						<div className="space-y-4">
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									Sambungkan dompet Anda untuk mengakses fitur penandatanganan
									sertifikat.
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
										dengan dompet ini. Silakan sambungkan dengan dompet
										penandatangan yang terdaftar.
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

					{/* Tab Penandatanganan Dokumen Tunggal */}
					<TabsContent value="single">
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Penandatanganan Sertifikat Tunggal
								</CardTitle>
								<CardDescription>
									Unggah dan tandatangani satu sertifikat PDF
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Detail Sertifikat */}
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
									placeholder="contoh: Master - Debugging Tanpa Menyentuh Kode - 2025"
									required
								/>

								{/* Posisi Kode QR */}
								<DropdownSelector
									id="qr-position-single"
									label="Posisi Kode QR"
									value={position}
									onValueChange={setPosition}
									options={Object.values(Position)}
									menuLabel="Posisi Kode QR"
									required
								/>

								{/* Unggah File Tunggal */}
								<FileUpload
									id="single-file-upload"
									label="Unggah File PDF"
									accept=".pdf"
									files={singleFile ? [singleFile] : []}
									onChange={(files) => setSingleFile(files[0] || null)}
									maxFiles={1}
									required
								/>

								{/* Tampilan Error */}
								{error && <AlertBox variant="destructive" message={error} />}

								{/* Progres */}
								{isProcessing && (
									<ProgressCard progress={progress} isActive={true} />
								)}

								{/* Tombol Aksi */}
								<ActionButtons
									buttons={[
										{
											id: "sign-single",
											label: "Tandatangani",
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

					{/* Tab Penandatanganan Beberapa Dokumen */}
					<TabsContent value="multiple">
						<div className="space-y-6 mb-6">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<FileText className="h-5 w-5" />
										Penandatanganan Beberapa Sertifikat
									</CardTitle>
									<CardDescription>
										Unggah beberapa file PDF dan metadata CSV untuk
										penandatanganan sekaligus
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									{/* Posisi Kode QR */}
									<DropdownSelector
										id="qr-position-multiple"
										label="Posisi Kode QR"
										value={position}
										onValueChange={setPosition}
										options={Object.values(Position)}
										menuLabel="Posisi Kode QR"
										required
									/>

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
													},
													error: (error) => {
														setCsvError(
															`Gagal menguraikan CSV: ${error.message}`
														);
														setCsvData([]);
													},
												});
											} else {
												// Menghapus state CSV saat tidak ada file yang dipilih
												setCsvFile(null);
												setCsvData([]);
												setCsvError(null);
											}
										}}
										maxFiles={1}
										description='CSV harus berisi header: "Nama File", "Nomor Sertifikat", "Penerima", "Pencapaian"'
										required
									/>

									{/* Unggah File PDF */}
									<FileUpload
										id="multiple-file-upload"
										label="Unggah File PDF"
										accept=".pdf"
										multiple={true}
										files={files}
										onChange={setFiles}
										required
									/>

									{/* Tampilan Error CSV */}
									{csvError && (
										<AlertBox variant="destructive" message={csvError} />
									)}

									{/* Tampilan Error */}
									{error && <AlertBox variant="destructive" message={error} />}

									{/* Progres */}
									{isProcessing && (
										<ProgressCard progress={progress} isActive={true} />
									)}

									{/* Tombol Aksi */}
									<ActionButtons
										buttons={[
											{
												id: "sign-multiple",
												label: "Tandatangani",
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
						</div>
					</TabsContent>
				</Tabs>
			)}

			{/* File yang Ditandatangani */}
			{signedFiles.length > 0 && (
				<ResultCard
					title="Sertifikat yang Ditandatangani"
					description="Sertifikat yang ditandatangani Anda siap untuk diunduh"
					items={signedFiles.map((file) => ({
						id: file.id,
						title: file.originalName,
						status: "success",
						badge: "Valid",
						details: [
							{ label: "Hash", value: file.hash, truncate: true },
							{
								label: "Tanda Tangan",
								value: `${file.signature.slice(0, 20)}...`,
								truncate: true,
							},
							{
								label: "Tanggal",
								value: new Date(file.date * 1000).toLocaleString(),
							},
							{ label: "Nomor Sertifikat", value: file.number, truncate: true },
							{ label: "Penerima", value: file.recipient, truncate: true },
							{ label: "Pencapaian", value: file.title, truncate: true },
						],
						url: {
							label: "URL Verifikasi",
							value: file.qrUrl,
						},
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

export default Sign;
