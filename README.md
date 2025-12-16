# Himatif UNEJ - Certificate Sign & Verification dApp

[🇬🇧 English Version](README-EN.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/znmn/himatif-certificate-web-app)

## 1. Deskripsi Proyek

Aplikasi web untuk tanda tangan dan verifikasi sertifikat digital Himatif UNEJ menggunakan ethereum wallet dan teknologi blockchain. Proyek ini menyediakan dua pendekatan:

- **Hybrid Mode**: Tanda tangan off-chain (EIP-712 typed data signature) dan verifikasi on-chain - lebih hemat gas
- **Full Onchain Mode (Untuk perbandingan)**: Tanda tangan dan verifikasi sepenuhnya on-chain dengan penyimpanan metadata sertifikat langsung di blockchain

## 2. Arsitektur Sistem

### Mode Operasi

| Mode           | Pendekatan                                | Keunggulan                                       |
| -------------- | ----------------------------------------- | ------------------------------------------------ |
| `Hybrid`       | Off-chain signing + On-chain verification | Gas lebih hemat, signature disimpan di PDF       |
| `Full Onchain` | Full on-chain storage                     | Data sertifikat tersimpan permanen di blockchain |

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS 4, Radix UI Components
- **Blockchain**: ethers.js 6, wagmi 3
- **PDF Processing**: pdf-lib, QRCode
- **State Management**: TanStack React Query

## 3. Fitur Utama

### Hybrid Mode

- Tanda tangan sertifikat menggunakan EIP-712 typed data signature
- Verifikasi signature on-chain melalui smart contract
- QR code tertanam di PDF untuk verifikasi cepat
- Mendukung tanda tangan tunggal dan batch (dengan CSV metadata)

### Full Onchain Mode

- Penyimpanan metadata sertifikat langsung di blockchain
- Verifikasi berdasarkan hash dokumen

### Fitur Testing (Opsional)

- Halaman Tests untuk pengujian performa batch
- Statistik waktu eksekusi dan biaya gas

## 4. Struktur Data Sertifikat

```typescript
interface Certificate {
	date: number; // Tanggal penerbitan (Unix timestamp)
	hash: string; // Hash dokumen (bytes32)
	number: string; // Nomor sertifikat
	recipient: string; // Nama penerima
	title: string; // Judul/pencapaian sertifikat
}
```

## 5. Instalasi

```bash
# Clone repository
git clone <repository-url>
cd <project-folder>

# Install dependencies
pnpm install

# Salin file environment
copy .env.example .env
```

## 6. Konfigurasi Environment

Edit file `.env` dengan konfigurasi berikut:

```env
# Base URL dari WEB APP
VITE_BASE_URL=http://localhost:5137

# Address dari Smart Contract Hybrid (EIP-712 signature verification)
VITE_HYBRID_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# Address dari Smart Contract Full Onchain (all data stored on-chain)
VITE_FULL_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# RPC URL dari EVM Network
VITE_RPC_URL=https://sepolia.infura.io/v3/{infura_api_key}

# Block Explorer URL (default: Sepolia Etherscan)
VITE_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io

# Aktifkan halaman testing (Tests dan GenerateTampering)
VITE_TESTING_ENABLED=false

# Mode hybrid only - set ke "false" untuk mengaktifkan halaman full onchain juga
VITE_ONLY_HYBRID=true
```

## 7. Menjalankan Aplikasi

```bash
# Development mode
pnpm dev

# Build untuk production
pnpm build

# Preview production build
pnpm preview
```

Aplikasi akan berjalan di `http://localhost:5137`

## 8. Deployment ke Vercel

### One-Click Deploy

Klik tombol di bawah untuk deploy langsung ke Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/znmn/himatif-certificate-web-app)

### Manual Deployment

1. **Install Vercel CLI** (opsional)

   ```bash
   npm install -g vercel
   ```

2. **Login ke Vercel**

   ```bash
   vercel login
   ```

3. **Deploy**

   ```bash
   vercel
   ```

4. **Konfigurasi Environment Variables**

   Di Vercel Dashboard, buka project → Settings → Environment Variables, lalu tambahkan:

   | Variable                       | Deskripsi                                                   |
   | ------------------------------ | ----------------------------------------------------------- |
   | `VITE_BASE_URL`                | URL production Anda (contoh: `https://your-app.vercel.app`) |
   | `VITE_HYBRID_CONTRACT_ADDRESS` | Alamat smart contract hybrid                                |
   | `VITE_FULL_CONTRACT_ADDRESS`   | Alamat smart contract full onchain                          |
   | `VITE_RPC_URL`                 | URL RPC (contoh: Infura, Alchemy)                           |
   | `VITE_BLOCK_EXPLORER_URL`      | URL block explorer                                          |
   | `VITE_TESTING_ENABLED`         | `true` atau `false`                                         |
   | `VITE_ONLY_HYBRID`             | `true` atau `false`                                         |

5. **Redeploy** setelah mengatur environment variables
   ```bash
   vercel --prod
   ```

## 9. Penggunaan

### Menandatangani Sertifikat (Hybrid Mode)

1. Sambungkan wallet (MetaMask atau wallet lain yang mendukung)
2. Pastikan wallet terhubung dengan alamat penandatangan yang terdaftar
3. Unggah file PDF sertifikat
4. Isi metadata (nomor sertifikat, penerima, pencapaian)
5. Pilih posisi QR code
6. Klik "Tandatangani"
7. Konfirmasi signature di wallet
8. Unduh PDF yang sudah ditandatangani

### Verifikasi Sertifikat

1. Unggah PDF yang sudah ditandatangani, atau
2. Scan QR code pada sertifikat
3. Sistem akan memverifikasi signature secara otomatis

### Batch Signing (Multiple Certificates)

1. Siapkan file CSV dengan format:
   - `Nama File`: nama file PDF
   - `Nomor Sertifikat`: nomor sertifikat
   - `Penerima`: nama penerima
   - `Pencapaian`: judul/pencapaian
2. Unggah file CSV dan semua file PDF
3. Klik "Tandatangani"
4. Unduh semua sertifikat dalam format ZIP

## 10. Dependensi

### Production

- `ethers`: ^6.15.0
- `wagmi`: ^3.0.1
- `pdf-lib`: ^1.17.1
- `qrcode`: ^1.5.4
- Dan lainnya (lihat `package.json`)

### Development

- `typescript`: ~5.9.3
- `vite`: ^7.2.4
- `eslint`: ^9.39.1
- Dan lainnya (lihat `package.json`)

## 11. Struktur Proyek

```
src/
├── assets/css/          # Stylesheet
├── components/
│   ├── ui/              # Komponen UI (shadcn/ui)
│   └── web/             # Komponen web kustom
├── hooks/
│   ├── use-wallet.ts    # Hook wallet untuk hybrid mode
│   └── full/            # Hook untuk full onchain mode
├── lib/
│   ├── contract.ts      # Interaksi kontrak hybrid
│   ├── pdf-utils.ts     # Utilitas PDF (sign, verify, embed QR)
│   ├── test-utils.ts    # Utilitas testing
│   └── full/            # Utilitas untuk full onchain mode
├── pages/
│   ├── Sign.tsx         # Halaman tanda tangan (hybrid)
│   ├── Verify.tsx       # Halaman verifikasi (hybrid)
│   ├── Tests.tsx        # Halaman testing (opsional)
│   ├── GenerateTampering.tsx  # Halaman generate tampering (opsional)
│   └── full/            # Halaman untuk full onchain mode
├── App.tsx              # Komponen utama aplikasi
├── config.ts            # Konfigurasi aplikasi
└── main.tsx             # Entry point
```

## 12. Lisensi

[MIT License](LICENSE)
