import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { keccak256 } from "ethers";
import { config } from "@/config";

const LF = "\n";

// Normalisasi string unicode ke NFC
const normalizeUnicode = (s: string): string => s.normalize("NFC");

export const Position = {
	UpperLeft: "atas-kiri",
	UpperCenter: "atas-tengah",
	UpperRight: "atas-kanan",
	MiddleLeft: "tengah-kiri",
	MiddleCenter: "tengah-tengah",
	MiddleRight: "tengah-kanan",
	LowerLeft: "bawah-kiri",
	LowerCenter: "bawah-tengah",
	LowerRight: "bawah-kanan",
} as const;

export type PositionType = (typeof Position)[keyof typeof Position];

export interface ExtractedData {
	hash: string;
}

// Menghitung ukuran QR berdasarkan dimensi halaman
function calculateQRSize(pageWidth: number, pageHeight: number): number {
	const minDimension = Math.min(pageWidth, pageHeight);
	let percentage: number;
	if (minDimension > 3000) percentage = 0.25;
	else if (minDimension > 1500) percentage = 0.22;
	else percentage = 0.2;

	const qrSize = minDimension * percentage;
	const MIN_SIZE = 100;
	const MAX_SIZE = 1500;
	return Math.max(MIN_SIZE, Math.min(MAX_SIZE, qrSize));
}

// Menghitung posisi QR pada halaman
function calculateQRPosition(
	position: PositionType,
	pageWidth: number,
	pageHeight: number,
	qrSize: number
) {
	const margin = 20;
	const positions = {
		[Position.UpperLeft]: [margin, pageHeight - margin - qrSize],
		[Position.UpperCenter]: [
			(pageWidth - qrSize) / 2,
			pageHeight - margin - qrSize,
		],
		[Position.UpperRight]: [
			pageWidth - margin - qrSize,
			pageHeight - margin - qrSize,
		],
		[Position.MiddleLeft]: [margin, (pageHeight - qrSize) / 2],
		[Position.MiddleCenter]: [
			(pageWidth - qrSize) / 2,
			(pageHeight - qrSize) / 2,
		],
		[Position.MiddleRight]: [
			pageWidth - margin - qrSize,
			(pageHeight - qrSize) / 2,
		],
		[Position.LowerLeft]: [margin, margin],
		[Position.LowerCenter]: [(pageWidth - qrSize) / 2, margin],
		[Position.LowerRight]: [pageWidth - margin - qrSize, margin],
	};
	const [x, y] = positions[position] || positions[Position.UpperLeft];
	return { x, y };
}

// Mengurai trailer PDF
function parseTrailer(buf: Uint8Array) {
	const txt = new TextDecoder("latin1").decode(buf);
	const sxIdx = txt.lastIndexOf("startxref");
	const xrefOffset = parseInt(
		/startxref\s+(\d+)/.exec(txt.slice(sxIdx))![1],
		10
	);

	const tIdx = txt.lastIndexOf("trailer", sxIdx);
	if (tIdx !== -1) {
		const dict = txt.slice(
			txt.indexOf("<<", tIdx),
			txt.indexOf(">>", tIdx) + 2
		);
		const size = /\/Size\s+(\d+)/.exec(dict);
		const root = /\/Root\s+(\d+\s+\d+\s+R)/.exec(dict);
		const info = /\/Info\s+(\d+\s+\d+\s+R)/.exec(dict);
		const id = /\/ID\s*\[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\]/.exec(
			dict
		);
		if (size && root) {
			return {
				size: parseInt(size[1], 10),
				rootRef: normalizeRef(root[1]),
				infoRef: info ? normalizeRef(info[1]) : null,
				idArray: id ? `<${id[1]}> <${id[2]}>` : null,
				xrefOffset,
			};
		}
	}

	let depth = 0,
		i = txt.indexOf("<<", xrefOffset);
	for (; i < txt.length - 1; i++) {
		if (txt[i] === "<" && txt[i + 1] === "<") {
			depth++;
			i++;
		} else if (txt[i] === ">" && txt[i + 1] === ">") {
			depth--;
			i++;
			if (depth === 0) break;
		}
	}
	const dict = txt.slice(txt.indexOf("<<", xrefOffset), i + 2);
	const size = /\/Size\s+(\d+)/.exec(dict);
	const root = /\/Root\s+(\d+\s+\d+\s+R)/.exec(dict);
	const info = /\/Info\s+(\d+\s+\d+\s+R)/.exec(dict);
	const id = /\/ID\s*\[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\]/.exec(dict);
	return {
		size: parseInt(size![1], 10),
		rootRef: normalizeRef(root![1]),
		infoRef: info ? normalizeRef(info[1]) : null,
		idArray: id ? `<${id[1]}> <${id[2]}>` : null,
		xrefOffset,
	};
}

// Mendapatkan dictionary objek PDF
function getObjectDict(buf: Uint8Array, objNum: number) {
	const txt = new TextDecoder("latin1").decode(buf);
	const m = new RegExp(`(?:\\r?\\n|^)${objNum}\\s+\\d+\\s+obj\\s*`).exec(txt);
	if (!m) return null;
	const ds = txt.indexOf("<<", m.index + m[0].length);
	if (ds === -1) return null;
	let depth = 0,
		i = ds;
	for (; i < txt.length - 1; i++) {
		if (txt[i] === "<" && txt[i + 1] === "<") {
			depth++;
			i++;
		} else if (txt[i] === ">" && txt[i + 1] === ">") {
			depth--;
			i++;
			if (depth === 0) break;
		}
	}
	return txt.slice(ds, i + 2);
}

// Normalisasi referensi PDF
function normalizeRef(ref: string) {
	return ref.replace(/\s+/g, " ").trim();
}

// Mengekstrak referensi dari dictionary
function extractRef(dict: string, key: string) {
	const m = new RegExp(`/${key}\\s+(\\d+\\s+\\d+\\s+R)`).exec(dict);
	return m ? normalizeRef(m[1]) : null;
}

// Mencari halaman dalam PDF
function findPage(buf: Uint8Array, rootRef: string, pageNumber = 1) {
	const rootDict = getObjectDict(buf, parseInt(rootRef.split(/\s+/)[0], 10));
	const pagesRef = extractRef(rootDict!, "Pages");
	if (!pagesRef) throw new Error("Pages not found");

	function collectPages(
		ref: string,
		pages: Array<{ pageObjNum: number; pageDict: string }> = []
	) {
		const dict = getObjectDict(buf, parseInt(ref.split(/\s+/)[0], 10));
		if (!dict) return pages;
		if (/\/Type\s*\/Page\b/.test(dict)) {
			pages.push({
				pageObjNum: parseInt(ref.split(/\s+/)[0], 10),
				pageDict: dict,
			});
		} else {
			const kids = /\/Kids\s*\[\s*([^\]]+)\]/.exec(dict);
			if (kids)
				kids[1].match(/\d+\s+\d+\s+R/g)?.forEach((r) => collectPages(r, pages));
		}
		return pages;
	}

	const allPages = collectPages(pagesRef);
	if (allPages.length === 0) throw new Error("No pages found");
	const targetPageIndex = pageNumber - 1;
	if (targetPageIndex < 0 || targetPageIndex >= allPages.length) {
		throw new Error(
			`Page ${pageNumber} not found. Total pages: ${allPages.length}`
		);
	}
	return allPages[targetPageIndex];
}

// Membuat matriks QR code
function makeQR(payload: string) {
	const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
	const n = qr.modules.size;
	return Array.from({ length: n }, (_, y) =>
		Array.from({ length: n }, (_, x) => (qr.modules.get(x, y) ? 1 : 0))
	);
}

// Membangun objek QR untuk PDF
function buildQRObject(objNum: number, matrix: number[][], px = 2, margin = 2) {
	const N = matrix.length;
	const W = (N + margin * 2) * px;
	const cmds = ["0 0 0 rg", "1 w"];
	for (let y = 0; y < N; y++) {
		for (let x = 0; x < N; x++) {
			if (matrix[y][x]) {
				const left = (x + margin) * px;
				const bottom = (N - 1 - y + margin) * px;
				cmds.push(`${left} ${bottom} ${px} ${px} re f`);
			}
		}
	}
	const stream = cmds.join(LF);
	return {
		obj: `${objNum} 0 obj\n<</Type/XObject/Subtype/Form/BBox[0 0 ${W} ${W}]/Resources<</ProcSet[/PDF]>>/Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj\n`,
		size: W,
	};
}

// Memodifikasi halaman PDF untuk menyertakan QR
function patchPage(
	buf: Uint8Array,
	pageObjNum: number,
	pageDict: string,
	formObjNum: number,
	contentObjNum: number
) {
	let dict = pageDict;
	const xName = "FmQR";
	const resRef = extractRef(dict, "Resources");
	let resObj = null;

	if (resRef) {
		const resNum = parseInt(resRef.split(/\s+/)[0], 10);
		const resDict = getObjectDict(buf, resNum);
		if (resDict) {
			const newRes = /\/XObject\s*<</.test(resDict)
				? resDict.replace(
						/\/XObject\s*<</,
						`/XObject<</${xName} ${formObjNum} 0 R `
				  )
				: resDict.replace(/>>$/, `/XObject<</${xName} ${formObjNum} 0 R>>>>`);
			resObj = {
				num: resNum,
				content: `${resNum} 0 obj\n${newRes.replace(/\s+/g, " ")}\nendobj\n`,
			};
		}
	}

	const contentsMatch = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(dict);
	if (contentsMatch) {
		dict = dict.replace(
			/\/Contents\s+\d+\s+\d+\s+R/,
			`/Contents[${contentsMatch[1]} 0 R ${contentObjNum} 0 R]`
		);
	} else if (/\/Contents\s*\[/.test(dict)) {
		dict = dict.replace(
			/\/Contents\s*\[([^\]]*)\]/,
			`/Contents[$1 ${contentObjNum} 0 R]`
		);
	}

	return {
		pageObj: `${pageObjNum} 0 obj\n${dict
			.replace(/\s+/g, " ")
			.trim()}\nendobj\n`,
		resObj,
	};
}

// Membangun tabel xref PDF
function buildXref(entries: Array<[number, number]>) {
	const sorted = [...entries].sort((a, b) => a[0] - b[0]);
	let xref = "xref\n",
		i = 0;
	while (i < sorted.length) {
		const start = sorted[i][0];
		const group = [];
		while (i < sorted.length && sorted[i][0] === start + group.length) {
			group.push(sorted[i][1].toString().padStart(10, "0") + " 00000 n \n");
			i++;
		}
		xref += `${start} ${group.length}\n${group.join("")}`;
	}
	return xref;
}

// Membuat PDF yang dinormalisasi
async function createNormalizedPDF(inputBytes: Uint8Array) {
	const pdfDoc = await PDFDocument.load(inputBytes);
	const pageDimensions = [];
	for (let i = 0; i < pdfDoc.getPageCount(); i++) {
		const { width, height } = pdfDoc.getPage(i).getSize();
		pageDimensions.push({ width, height });
	}
	const normalizedBytes = await pdfDoc.save({ useObjectStreams: false });
	return { normalizedBytes, pageDimensions };
}

// Menyematkan QR code (hanya URL) ke dalam PDF - untuk full onchain, QR hanya berisi URL verifikasi dengan hash
export async function embedQROnly(
	qrUrl: string,
	pageNumber = 1,
	position: PositionType = Position.MiddleLeft,
	normalizedBytes: Uint8Array,
	pageDimensions: Array<{ width: number; height: number }>
): Promise<Uint8Array> {
	if (pageNumber < 1 || pageNumber > pageDimensions.length) {
		throw new Error(
			`Page ${pageNumber} not found. Total pages: ${pageDimensions.length}`
		);
	}
	const { width: pageWidth, height: pageHeight } =
		pageDimensions[pageNumber - 1];

	const original = normalizedBytes;
	const { size, rootRef, infoRef, idArray, xrefOffset } =
		parseTrailer(original);
	const { pageObjNum, pageDict } = findPage(original, rootRef, pageNumber);

	const origLen = original.length;
	const prefix = new Uint8Array([
		...original,
		...new TextEncoder().encode(`\n% ORIGLEN=${origLen}\n`),
	]);

	const formNum = size,
		contentNum = size + 1;
	const matrix = makeQR(qrUrl);
	const { obj: formObj, size: qrSize } = buildQRObject(formNum, matrix);

	const targetQRSize = calculateQRSize(pageWidth, pageHeight);
	const scale = targetQRSize / qrSize;
	const { x, y } = calculateQRPosition(
		position,
		pageWidth,
		pageHeight,
		targetQRSize
	);

	const qrCommands = [
		"q",
		`${scale} 0 0 ${scale} ${x} ${y} cm`,
		"1 1 1 rg",
		`0 0 ${qrSize} ${qrSize} re f`,
		"0 0 0 rg",
	];
	for (let yi = 0; yi < matrix.length; yi++) {
		for (let xi = 0; xi < matrix.length; xi++) {
			if (matrix[yi][xi]) {
				const left = (xi + 2) * 2;
				const bottom = (matrix.length - 1 - yi + 2) * 2;
				qrCommands.push(`${left} ${bottom} 2 2 re f`);
			}
		}
	}
	qrCommands.push("Q");

	const contentStream = qrCommands.join(LF);
	const contentObj = `${contentNum} 0 obj\n<</Length ${contentStream.length}/Resources<</XObject<</FmQR ${formNum} 0 R>>>>>>\nstream\n${contentStream}\nendstream\nendobj\n`;

	const { pageObj, resObj } = patchPage(
		normalizedBytes,
		pageObjNum,
		pageDict,
		formNum,
		contentNum
	);

	let offset = prefix.length;
	const entries: Array<[number, number]> = [
		[formNum, offset],
		[contentNum, (offset += formObj.length)],
		[pageObjNum, (offset += contentObj.length)],
	];
	if (resObj) entries.push([resObj.num, (offset += pageObj.length)]);

	const xrefOffset2 =
		offset + (resObj ? resObj.content.length : pageObj.length);
	const xref = buildXref(entries);

	const maxNum = Math.max(...entries.map(([n]) => n));
	let trailer = `trailer\n<<\n/Size ${
		maxNum + 1
	}\n/Root ${rootRef}\n/Prev ${xrefOffset}\n`;
	if (infoRef) trailer += `/Info ${infoRef}\n`;
	if (idArray) trailer += `/ID [${idArray}]\n`;
	trailer += ">>\n";

	return new Uint8Array([
		...prefix,
		...new TextEncoder().encode(formObj),
		...new TextEncoder().encode(contentObj),
		...new TextEncoder().encode(pageObj),
		...(resObj ? [...new TextEncoder().encode(resObj.content)] : []),
		...new TextEncoder().encode(xref),
		...new TextEncoder().encode(trailer),
		...new TextEncoder().encode(`startxref\n${xrefOffset2}\n%%EOF\n`),
	]);
}

// Melepaskan QR dari PDF - mengembalikan PDF untuk verifikasi hash
export async function detachQR(
	inputBytes: Uint8Array
): Promise<{ restored: Uint8Array }> {
	const buf = inputBytes;
	const txt = new TextDecoder("latin1").decode(buf);

	const origLenMatch = /% ORIGLEN=(\d+)/.exec(txt);

	if (!origLenMatch) {
		const lastEof = txt.lastIndexOf("%%EOF");
		const secondLastEof = txt.lastIndexOf("%%EOF", lastEof - 1);
		const restored = buf.subarray(0, secondLastEof + 5);
		return { restored };
	}

	const origLen = parseInt(origLenMatch[1], 10);

	const afterOrigLen = txt.slice(origLen);

	const firstEofAfterOrigLen = afterOrigLen.indexOf("%%EOF");
	if (firstEofAfterOrigLen === -1) {
		return { restored: buf.subarray(0, origLen) };
	}

	const signatureBlockEnd = origLen + firstEofAfterOrigLen + 5;

	if (signatureBlockEnd >= buf.length) {
		return { restored: buf.subarray(0, origLen) };
	}

	const modificationsBytes = buf.subarray(signatureBlockEnd);

	let hasRealContent = false;
	for (let i = 0; i < modificationsBytes.length; i++) {
		const byte = modificationsBytes[i];
		if (byte !== 32 && byte !== 9 && byte !== 13 && byte !== 10) {
			hasRealContent = true;
			break;
		}
	}

	if (!hasRealContent) {
		return { restored: buf.subarray(0, origLen) };
	}

	const normalizedPdf = buf.subarray(0, origLen);

	const restored = new Uint8Array(
		normalizedPdf.length + modificationsBytes.length
	);
	restored.set(normalizedPdf, 0);
	restored.set(modificationsBytes, normalizedPdf.length);

	console.log(
		`PDF was modified after signing. Original: ${origLen} bytes, Modifications: ${modificationsBytes.length} bytes`
	);

	return { restored };
}

// Normalisasi PDF dan menghitung hash
export async function normalizePdfAndHash(inputBytes: Uint8Array): Promise<{
	normalizedBytes: Uint8Array;
	hash: string;
	pageDimensions: Array<{ width: number; height: number }>;
}> {
	const { normalizedBytes, pageDimensions } = await createNormalizedPDF(
		inputBytes
	);
	const hash = keccak256(normalizedBytes);
	return { normalizedBytes, hash, pageDimensions };
}

// Alur penandatanganan dokumen untuk full onchain
export async function signDocumentOnchain(
	inputBytes: Uint8Array,
	number: string,
	recipient: string,
	title: string,
	position: PositionType = Position.MiddleLeft,
	onchainSignFunction: (
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
	}>
): Promise<{
	signedPdf: Uint8Array;
	hash: string;
	qrUrl: string;
	timestamp: number;
	txHash: string;
	gasUsed: bigint;
	effectiveGasPrice: bigint;
	totalFee: bigint;
	totalFeeETH: string;
}> {
	const timestamp = Math.floor(Date.now() / 1000);

	const { normalizedBytes, hash, pageDimensions } = await normalizePdfAndHash(
		inputBytes
	);

	const normalizedNumber = normalizeUnicode(number);
	const normalizedRecipient = normalizeUnicode(recipient);
	const normalizedTitle = normalizeUnicode(title);

	const txResult = await onchainSignFunction(
		timestamp,
		hash,
		normalizedNumber,
		normalizedRecipient,
		normalizedTitle
	);

	const qrUrl = `${
		typeof window !== "undefined" ? window.location.origin : config.BASE_URL
	}/full/verify?hash=${encodeURIComponent(hash)}`;

	const signedPdfBytes = await embedQROnly(
		qrUrl,
		1,
		position,
		normalizedBytes,
		pageDimensions
	);

	return {
		signedPdf: signedPdfBytes,
		hash,
		qrUrl,
		timestamp,
		...txResult,
	};
}

// Alur penandatanganan dokumen untuk full onchain dengan waktu terpisah
export async function signDocumentOnchainSplit(
	inputBytes: Uint8Array,
	number: string,
	recipient: string,
	title: string,
	position: PositionType = Position.MiddleLeft,
	onchainSignFunction: (
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
	txHash: string;
	gasUsed: bigint;
	effectiveGasPrice: bigint;
	totalFee: bigint;
	totalFeeETH: string;
	txSentTime: number;
	confirmedTime: number;
}> {
	const timestamp = Math.floor(Date.now() / 1000);

	const { normalizedBytes, hash, pageDimensions } = await normalizePdfAndHash(
		inputBytes
	);

	const normalizedNumber = normalizeUnicode(number);
	const normalizedRecipient = normalizeUnicode(recipient);
	const normalizedTitle = normalizeUnicode(title);

	const txResult = await onchainSignFunction(
		timestamp,
		hash,
		normalizedNumber,
		normalizedRecipient,
		normalizedTitle
	);

	const qrUrl = `${
		typeof window !== "undefined" ? window.location.origin : config.BASE_URL
	}/full/verify?hash=${encodeURIComponent(hash)}`;

	const signedPdfBytes = await embedQROnly(
		qrUrl,
		1,
		position,
		normalizedBytes,
		pageDimensions
	);

	return {
		signedPdf: signedPdfBytes,
		hash,
		qrUrl,
		timestamp,
		...txResult,
	};
}

// Alur verifikasi dokumen untuk full onchain
export async function verifyDocumentOnchain(
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
}> {
	try {
		const { restored } = await detachQR(inputBytes);

		const recalculatedHash = keccak256(restored);

		const result = await verifyFunction(recalculatedHash);

		return {
			...result,
			recalculatedHash,
		};
	} catch (err) {
		console.error("Verification error:", err);
		return {
			isValid: false,
			date: 0,
			number: "",
			recipient: "",
			title: "",
			signer: "",
			signerNameAtTime: "",
			recalculatedHash: "",
		};
	}
}
