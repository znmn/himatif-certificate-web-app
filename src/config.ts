// Konfigurasi Aplikasi
export const config = {
	// URL dasar untuk link verifikasi
	BASE_URL: import.meta.env.VITE_BASE_URL || "http://localhost:5173",

	// Konfigurasi Kontrak Hybrid (tanda tangan off-chain, verifikasi on-chain)
	HYBRID_CONTRACT_ADDRESS: import.meta.env.VITE_HYBRID_CONTRACT_ADDRESS || "",

	// Konfigurasi Kontrak Full Onchain (semua data tersimpan di blockchain)
	FULL_CONTRACT_ADDRESS: import.meta.env.VITE_FULL_CONTRACT_ADDRESS || "",

	// URL RPC default
	RPC_URL: import.meta.env.VITE_RPC_URL || "https://sepolia.drpc.org",

	// URL Block Explorer
	BLOCK_EXPLORER_URL:
		import.meta.env.VITE_BLOCK_EXPLORER_URL || "https://sepolia.etherscan.io",

	// ABI Kontrak Verifikasi Hybrid (verifikasi tanda tangan EIP-712)
	HYBRID_VERIFICATION_ABI: [
		"function appName() view returns (string)",
		"function version() view returns (string)",
		"function signerAddress() view returns (address)",
		"function signerName() view returns (string)",
		"function verifyCertificate(uint256 date, bytes32 hash, string number, string recipient, string title, bytes signature) view returns (bool, address, string)",
	] as const,

	// ABI Kontrak Verifikasi Full Onchain (penyimpanan on-chain)
	FULL_VERIFICATION_ABI: [
		"function appName() view returns (string)",
		"function version() view returns (string)",
		"function signerAddress() view returns (address)",
		"function signerName() view returns (string)",
		"function signCertificate(uint256 date, bytes32 hash, string number, string recipient, string title)",
		"function verifyCertificate(bytes32 hash) view returns (bool isValid, uint256 date, string number, string recipient, string title, address signer, string signerNameAtTime)",
		"function certificateExists(bytes32 hash) view returns (bool)",
		"function getCertificateCount() view returns (uint256)",
		"function getCertificateHashByIndex(uint256 index) view returns (bytes32)",
		"function updateSignerName(string newSignerName)",
	] as const,
} as const;
