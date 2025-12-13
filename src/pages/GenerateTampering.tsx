import React, { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ethers, keccak256 } from "ethers";
import { signCertificateWithPrivateKey } from "@/lib/test-utils";
import { FileUpload } from "@/components/web";
import { PDFDocument } from "pdf-lib";
import { embedInfo, Position, type PositionType } from "@/lib/pdf-utils";
import { config } from "@/config";
import QRCode from "qrcode";

import {
	Download,
	FlaskConical,
	KeyRound,
	FileEdit,
	QrCode,
	Lock,
} from "lucide-react";
import { toast } from "sonner";

// Hardcode Password
const ACCESS_PASSWORD = "himatif_tamper2024";

// Fungsi untuk normalisasi PDF
async function normalizePdf(inputBytes: Uint8Array): Promise<{
	normalizedBytes: Uint8Array;
	pageDimensions: Array<{ width: number; height: number }>;
	hash: string;
}> {
	const pdfDoc = await PDFDocument.load(inputBytes);
	const pageDimensions = [];
	for (let i = 0; i < pdfDoc.getPageCount(); i++) {
		const { width, height } = pdfDoc.getPage(i).getSize();
		pageDimensions.push({ width, height });
	}
	const normalizedBytes = await pdfDoc.save({ useObjectStreams: false });
	const hash = keccak256(normalizedBytes);
	return { normalizedBytes, pageDimensions, hash };
}

// Fungsi untuk generate QR code sebagai PNG data URL
async function generateQRCodePNG(
	payload: string,
	size: number = 300
): Promise<string> {
	const dataUrl = await QRCode.toDataURL(payload, {
		errorCorrectionLevel: "M",
		margin: 2,
		width: size,
		color: {
			dark: "#000000",
			light: "#FFFFFF",
		},
	});
	return dataUrl;
}

const GenerateTampering: React.FC = () => {
	// Password state
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [passwordInput, setPasswordInput] = useState("");
	const [passwordError, setPasswordError] = useState("");

	// State untuk Tab 1: Generate QR dengan payload manual
	const [qrDate, setQrDate] = useState("");
	const [qrHash, setQrHash] = useState("");
	const [qrNumber, setQrNumber] = useState("");
	const [qrRecipient, setQrRecipient] = useState("");
	const [qrTitle, setQrTitle] = useState("");
	const [qrSignature, setQrSignature] = useState("");
	const [qrSize, setQrSize] = useState("300");
	const [qrPreview, setQrPreview] = useState<string | null>(null);
	const [isGeneratingQR, setIsGeneratingQR] = useState(false);

	// State untuk Tab 2: Unregistered Signer
	const [unregPdfFile, setUnregPdfFile] = useState<File[]>([]);
	const [unregHash, setUnregHash] = useState("");
	const [unregPrivateKey, setUnregPrivateKey] = useState("");
	const [unregDate, setUnregDate] = useState("");
	const [unregNumber, setUnregNumber] = useState("");
	const [unregRecipient, setUnregRecipient] = useState("");
	const [unregTitle, setUnregTitle] = useState("");
	const [unregPosition, setUnregPosition] = useState<PositionType>(
		Position.LowerRight
	);
	const [isEmbeddingUnreg, setIsEmbeddingUnreg] = useState(false);
	const [unregNormalizedBytes, setUnregNormalizedBytes] =
		useState<Uint8Array | null>(null);
	const [unregPageDimensions, setUnregPageDimensions] = useState<
		Array<{ width: number; height: number }>
	>([]);

	// Handle password submit
	const handlePasswordSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (passwordInput === ACCESS_PASSWORD) {
			setIsAuthenticated(true);
			setPasswordError("");
			toast.success("Akses diberikan");
		} else {
			setPasswordError("Password salah");
			toast.error("Password salah");
		}
	};

	// Generate QR code dan auto download
	const generateAndDownloadQR = async () => {
		setIsGeneratingQR(true);
		try {
			const date = parseInt(qrDate, 10);
			if (isNaN(date) || date <= 0) {
				throw new Error("Format tanggal tidak valid (harus integer positif)");
			}

			if (!qrHash.startsWith("0x") || qrHash.length !== 66) {
				throw new Error("Format hash tidak valid (harus 0x + 64 karakter hex)");
			}

			if (!qrSignature.startsWith("0x") || qrSignature.length !== 132) {
				throw new Error(
					"Format signature tidak valid (harus 0x + 130 karakter hex)"
				);
			}

			const qrUrl = `${config.BASE_URL}/verify?signature=${encodeURIComponent(
				qrSignature
			)}&date=${date}&hash=${encodeURIComponent(
				qrHash
			)}&number=${encodeURIComponent(qrNumber)}&recipient=${encodeURIComponent(
				qrRecipient
			)}&title=${encodeURIComponent(qrTitle)}`;

			const size = parseInt(qrSize, 10) || 300;
			const dataUrl = await generateQRCodePNG(qrUrl, size);

			setQrPreview(dataUrl);

			const a = document.createElement("a");
			a.href = dataUrl;
			a.download = `qr_tampered_${Date.now()}.png`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			toast.success("QR Code berhasil dibuat!", {
				description: "File PNG telah didownload.",
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Gagal membuat QR";
			toast.error("Error", { description: message });
		} finally {
			setIsGeneratingQR(false);
		}
	};

	const handleUnregPdfChange = async (files: File[]) => {
		setUnregPdfFile(files);
		if (files.length > 0) {
			try {
				const buffer = await files[0].arrayBuffer();
				const bytes = new Uint8Array(buffer);
				const { normalizedBytes, pageDimensions, hash } = await normalizePdf(
					bytes
				);
				setUnregNormalizedBytes(normalizedBytes);
				setUnregPageDimensions(pageDimensions);
				setUnregHash(hash);
				toast.success("PDF siap", {
					description: `Hash: ${hash.slice(0, 20)}...`,
				});
			} catch {
				toast.error("Gagal memproses PDF");
				setUnregHash("");
				setUnregNormalizedBytes(null);
			}
		} else {
			setUnregHash("");
			setUnregNormalizedBytes(null);
		}
	};

	const embedUnregisteredSignature = async () => {
		if (!unregNormalizedBytes || unregPageDimensions.length === 0) {
			toast.error("Upload PDF terlebih dahulu");
			return;
		}

		setIsEmbeddingUnreg(true);
		try {
			const date = parseInt(unregDate, 10);
			if (isNaN(date) || date <= 0) {
				throw new Error("Format tanggal tidak valid");
			}

			let privateKey = unregPrivateKey.trim();
			if (!privateKey.startsWith("0x")) {
				privateKey = `0x${privateKey}`;
			}
			if (privateKey.length !== 66) {
				throw new Error("Format private key tidak valid");
			}

			const signature = await signCertificateWithPrivateKey(
				privateKey,
				date,
				unregHash,
				unregNumber,
				unregRecipient,
				unregTitle
			);

			const textAttachment = `Date: ${date}\nSignature: ${signature}\nNumber: ${unregNumber}\nRecipient: ${unregRecipient}\nTitle: ${unregTitle}`;

			const qrUrl = `${config.BASE_URL}/verify?signature=${encodeURIComponent(
				signature
			)}&date=${date}&hash=${encodeURIComponent(
				unregHash
			)}&number=${encodeURIComponent(
				unregNumber
			)}&recipient=${encodeURIComponent(
				unregRecipient
			)}&title=${encodeURIComponent(unregTitle)}`;

			const signedPdf = await embedInfo(
				qrUrl,
				textAttachment,
				1,
				unregPosition,
				unregNormalizedBytes,
				unregPageDimensions
			);

			const blob = new Blob([new Uint8Array(signedPdf)], {
				type: "application/pdf",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `unregistered_signer_${
				unregPdfFile[0]?.name || "document.pdf"
			}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			const wallet = new ethers.Wallet(privateKey);
			toast.success("PDF berhasil dibuat!", {
				description: `Penandatangan: ${wallet.address.slice(0, 10)}...`,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Gagal membuat PDF";
			toast.error("Error", { description: message });
		} finally {
			setIsEmbeddingUnreg(false);
		}
	};

	const generateRandomPrivateKey = () => {
		const wallet = ethers.Wallet.createRandom();
		setUnregPrivateKey(wallet.privateKey);
		toast.info("Private key random dibuat", {
			description: `Alamat: ${wallet.address.slice(
				0,
				10
			)}...${wallet.address.slice(-6)}`,
		});
	};

	const generateCurrentTimestamp = (setter: (value: string) => void) => {
		const timestamp = Math.floor(Date.now() / 1000);
		setter(timestamp.toString());
	};

	const generateRandomHash = () => {
		const randomBytes = ethers.randomBytes(32);
		const hash = ethers.hexlify(randomBytes);
		setQrHash(hash);
	};

	const positionOptions = Object.entries(Position).map(([key, value]) => ({
		label: key.replace(/([A-Z])/g, " $1").trim(),
		value,
	}));

	// Password screen
	if (!isAuthenticated) {
		return (
			<div className="container mx-auto px-4 py-8 max-w-md">
				<Card>
					<CardHeader className="text-center">
						<div className="flex justify-center mb-4">
							<Lock className="h-12 w-12 text-muted-foreground" />
						</div>
						<CardTitle>Akses Terbatas</CardTitle>
						<CardDescription>
							Halaman ini memerlukan password untuk mengakses
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handlePasswordSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									placeholder="Masukkan password"
									value={passwordInput}
									onChange={(e) => setPasswordInput(e.target.value)}
									autoFocus
								/>
								{passwordError && (
									<p className="text-sm text-red-500">{passwordError}</p>
								)}
							</div>
							<Button type="submit" className="w-full">
								Masuk
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
					<FlaskConical className="h-10 w-10" />
					Generate Tampering
				</h1>
				<p className="text-lg text-muted-foreground">
					Buat QR code atau PDF dengan data yang di-tamper untuk pengujian
					verifikasi
				</p>
			</div>

			<Tabs defaultValue="tamper-qr" className="space-y-6">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="tamper-qr" className="flex items-center gap-2">
						<FileEdit className="h-4 w-4" />
						Ubah Payload (QR)
					</TabsTrigger>
					<TabsTrigger
						value="unregistered-signer"
						className="flex items-center gap-2"
					>
						<KeyRound className="h-4 w-4" />
						Alamat Tidak Terdaftar
					</TabsTrigger>
				</TabsList>

				{/* Tab 1: Generate QR dengan payload manual */}
				<TabsContent value="tamper-qr">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<QrCode className="h-5 w-5" />
								Buat QR Code dengan Payload Diubah
							</CardTitle>
							<CardDescription>
								Masukkan semua data secara manual untuk membuat QR code. QR akan
								di-download sebagai PNG yang siap ditempel ke sertifikat untuk
								pengujian deteksi tampering.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="qr-date">Tanggal (Unix Timestamp)</Label>
									<div className="flex gap-2">
										<Input
											id="qr-date"
											type="number"
											placeholder="1702400000"
											value={qrDate}
											onChange={(e) => setQrDate(e.target.value)}
										/>
										<Button
											variant="outline"
											size="sm"
											onClick={() => generateCurrentTimestamp(setQrDate)}
										>
											Now
										</Button>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="qr-size">Ukuran QR (px)</Label>
									<Input
										id="qr-size"
										type="number"
										placeholder="300"
										value={qrSize}
										onChange={(e) => setQrSize(e.target.value)}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="qr-hash">Hash Dokumen (bytes32)</Label>
								<div className="flex gap-2">
									<Input
										id="qr-hash"
										placeholder="0x..."
										value={qrHash}
										onChange={(e) => setQrHash(e.target.value)}
									/>
									<Button
										variant="outline"
										size="sm"
										onClick={generateRandomHash}
									>
										Random
									</Button>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="qr-signature">Signature (bytes)</Label>
								<Input
									id="qr-signature"
									placeholder="0x..."
									value={qrSignature}
									onChange={(e) => setQrSignature(e.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									💡 Masukkan signature asli dari sertifikat valid, lalu ubah
									metadata di bawah
								</p>
							</div>

							<Separator />

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label htmlFor="qr-number">Nomor Sertifikat</Label>
									<Input
										id="qr-number"
										placeholder="CERT-001"
										value={qrNumber}
										onChange={(e) => setQrNumber(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="qr-recipient">Penerima</Label>
									<Input
										id="qr-recipient"
										placeholder="John Doe"
										value={qrRecipient}
										onChange={(e) => setQrRecipient(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="qr-title">Judul/Pencapaian</Label>
									<Input
										id="qr-title"
										placeholder="Certificate of Completion"
										value={qrTitle}
										onChange={(e) => setQrTitle(e.target.value)}
									/>
								</div>
							</div>

							<Button
								onClick={generateAndDownloadQR}
								disabled={isGeneratingQR || !qrDate || !qrHash || !qrSignature}
								className="w-full"
							>
								{isGeneratingQR ? (
									"Membuat QR..."
								) : (
									<>
										<Download className="mr-2 h-4 w-4" />
										Generate & Download QR PNG
									</>
								)}
							</Button>

							{qrPreview && (
								<div className="space-y-2">
									<Label>Preview QR Code</Label>
									<div className="flex justify-center p-4 bg-white rounded-md border">
										<img
											src={qrPreview}
											alt="QR Code Preview"
											className="max-w-full"
										/>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Tab 2: Unregistered Signer */}
				<TabsContent value="unregistered-signer">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<KeyRound className="h-5 w-5" />
								Buat PDF dengan Signature Tidak Terdaftar
							</CardTitle>
							<CardDescription>
								Upload PDF, generate signature dengan private key random (tidak
								terdaftar di kontrak), lalu download PDF. Signature akan valid
								secara kriptografis tapi alamat tidak terdaftar.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<FileUpload
								id="unreg-pdf-upload"
								label="Upload PDF"
								accept=".pdf"
								multiple={false}
								files={unregPdfFile}
								onChange={handleUnregPdfChange}
								description="Upload file PDF yang akan ditandatangani dengan private key tidak terdaftar"
								required
							/>

							{unregHash && (
								<div className="space-y-2">
									<Label>Hash PDF (dihitung otomatis)</Label>
									<div className="p-3 bg-muted rounded-md">
										<code className="text-xs break-all">{unregHash}</code>
									</div>
								</div>
							)}

							<Separator />

							<div className="space-y-2">
								<Label htmlFor="unreg-private-key">
									Private Key (untuk testing)
								</Label>
								<div className="flex gap-2">
									<Input
										id="unreg-private-key"
										type="password"
										placeholder="0x..."
										value={unregPrivateKey}
										onChange={(e) => setUnregPrivateKey(e.target.value)}
									/>
									<Button variant="outline" onClick={generateRandomPrivateKey}>
										Random Key
									</Button>
								</div>
								<p className="text-xs text-muted-foreground">
									⚠️ Gunakan private key random. JANGAN gunakan private key
									asli!
								</p>
							</div>

							<Separator />

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="unreg-date">Tanggal (Unix Timestamp)</Label>
									<div className="flex gap-2">
										<Input
											id="unreg-date"
											type="number"
											placeholder="1702400000"
											value={unregDate}
											onChange={(e) => setUnregDate(e.target.value)}
										/>
										<Button
											variant="outline"
											size="sm"
											onClick={() => generateCurrentTimestamp(setUnregDate)}
										>
											Now
										</Button>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="unreg-position">Posisi QR</Label>
									<Select
										value={unregPosition}
										onValueChange={(v) => setUnregPosition(v as PositionType)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{positionOptions.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label htmlFor="unreg-number">Nomor Sertifikat</Label>
									<Input
										id="unreg-number"
										placeholder="CERT-001"
										value={unregNumber}
										onChange={(e) => setUnregNumber(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="unreg-recipient">Penerima</Label>
									<Input
										id="unreg-recipient"
										placeholder="John Doe"
										value={unregRecipient}
										onChange={(e) => setUnregRecipient(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="unreg-title">Judul/Pencapaian</Label>
									<Input
										id="unreg-title"
										placeholder="Certificate of Completion"
										value={unregTitle}
										onChange={(e) => setUnregTitle(e.target.value)}
									/>
								</div>
							</div>

							<Button
								onClick={embedUnregisteredSignature}
								disabled={
									isEmbeddingUnreg ||
									!unregHash ||
									!unregPrivateKey ||
									!unregDate
								}
								className="w-full"
							>
								{isEmbeddingUnreg ? (
									"Membuat PDF..."
								) : (
									<>
										<Download className="mr-2 h-4 w-4" />
										Generate Signature & Download PDF
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
};

export default GenerateTampering;
