# Himatif UNEJ - Certificate Sign & Verification dApp

[🇮🇩 Versi Indonesia](README.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/znmn/himatif-certificate-web-app)

## 1. Project Description

A web application for signing and verifying Himatif UNEJ digital certificates using ethereum wallet and blockchain technology. This project provides two approaches:

- **Hybrid Mode**: Off-chain signing (EIP-712 typed data signature) and on-chain verification - more gas efficient
- **Full Onchain Mode (For comparison)**: Fully on-chain signing and verification with certificate metadata stored directly on the blockchain

## 2. System Architecture

### Operation Modes

| Mode           | Approach                                  | Advantages                                        |
| -------------- | ----------------------------------------- | ------------------------------------------------- |
| `Hybrid`       | Off-chain signing + On-chain verification | More gas efficient, signature stored in PDF       |
| `Full Onchain` | Full on-chain storage                     | Certificate data permanently stored on blockchain |

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS 4, Radix UI Components
- **Blockchain**: ethers.js 6, wagmi 3
- **PDF Processing**: pdf-lib, QRCode
- **State Management**: TanStack React Query

## 3. Key Features

### Hybrid Mode

- Certificate signing using EIP-712 typed data signature
- On-chain signature verification through smart contract
- QR code embedded in PDF for quick verification
- Supports single and batch signing (with CSV metadata)

### Full Onchain Mode

- Certificate metadata stored directly on blockchain
- Verification based on document hash

### Testing Features (Optional)

- Tests page for batch performance testing
- Execution time and gas cost statistics

## 4. Certificate Data Structure

```typescript
interface Certificate {
	date: number; // Issue date (Unix timestamp)
	hash: string; // Document hash (bytes32)
	number: string; // Certificate number
	recipient: string; // Recipient name
	title: string; // Certificate title/achievement
}
```

## 5. Installation

```bash
# Clone repository
git clone <repository-url>
cd <project-folder>

# Install dependencies
pnpm install

# Copy environment file
copy .env.example .env
```

## 6. Environment Configuration

Edit the `.env` file with the following configuration:

```env
# Base URL of the WEB APP
VITE_BASE_URL=http://localhost:5137

# Hybrid Smart Contract Address (EIP-712 signature verification)
VITE_HYBRID_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# Full Onchain Smart Contract Address (all data stored on-chain)
VITE_FULL_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# RPC URL of EVM Network
VITE_RPC_URL=https://sepolia.infura.io/v3/{infura_api_key}

# Block Explorer URL (default: Sepolia Etherscan)
VITE_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io

# Enable testing pages (Tests and GenerateTampering)
VITE_TESTING_ENABLED=false

# Hybrid only mode - set to "false" to enable full onchain pages as well
VITE_ONLY_HYBRID=true
```

## 7. Running the Application

```bash
# Development mode
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

The application will run at `http://localhost:5137`

## 8. Deployment to Vercel

### One-Click Deploy

Click the button below to deploy directly to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/znmn/himatif-certificate-web-app&env=VITE_BASE_URL,VITE_HYBRID_CONTRACT_ADDRESS,VITE_FULL_CONTRACT_ADDRESS,VITE_RPC_URL,VITE_BLOCK_EXPLORER_URL,VITE_TESTING_ENABLED,VITE_ONLY_HYBRID)

### Manual Deployment

1. **Install Vercel CLI** (optional)

   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**

   ```bash
   vercel login
   ```

3. **Deploy**

   ```bash
   vercel
   ```

4. **Configure Environment Variables**

   In Vercel Dashboard, go to your project → Settings → Environment Variables, then add:

   | Variable                       | Description                                               |
   | ------------------------------ | --------------------------------------------------------- |
   | `VITE_BASE_URL`                | Your production URL (e.g., `https://your-app.vercel.app`) |
   | `VITE_HYBRID_CONTRACT_ADDRESS` | Hybrid smart contract address                             |
   | `VITE_FULL_CONTRACT_ADDRESS`   | Full onchain smart contract address                       |
   | `VITE_RPC_URL`                 | RPC URL (e.g., Infura, Alchemy)                           |
   | `VITE_BLOCK_EXPLORER_URL`      | Block explorer URL                                        |
   | `VITE_TESTING_ENABLED`         | `true` or `false`                                         |
   | `VITE_ONLY_HYBRID`             | `true` or `false`                                         |

5. **Redeploy** after setting environment variables
   ```bash
   vercel --prod
   ```

## 9. Usage

### Signing Certificates (Hybrid Mode)

1. Connect wallet (MetaMask or other supported wallets)
2. Ensure wallet is connected with the registered signer address
3. Upload PDF certificate file
4. Fill in metadata (certificate number, recipient, achievement)
5. Select QR code position
6. Click "Sign"
7. Confirm signature in wallet
8. Download the signed PDF

### Certificate Verification

1. Upload the signed PDF, or
2. Scan the QR code on the certificate
3. The system will automatically verify the signature

### Batch Signing (Multiple Certificates)

1. Prepare a CSV file with the format:
   - `Nama File`: PDF file name
   - `Nomor Sertifikat`: certificate number
   - `Penerima`: recipient name
   - `Pencapaian`: title/achievement
2. Upload the CSV file and all PDF files
3. Click "Sign"
4. Download all certificates in ZIP format

## 10. Dependencies

### Production

- `ethers`: ^6.15.0
- `wagmi`: ^3.0.1
- `pdf-lib`: ^1.17.1
- `qrcode`: ^1.5.4
- And others (see `package.json`)

### Development

- `typescript`: ~5.9.3
- `vite`: ^7.2.4
- `eslint`: ^9.39.1
- And others (see `package.json`)

## 11. Project Structure

```
src/
├── assets/css/          # Stylesheets
├── components/
│   ├── ui/              # UI components (shadcn/ui)
│   └── web/             # Custom web components
├── hooks/
│   ├── use-wallet.ts    # Wallet hook for hybrid mode
│   └── full/            # Hooks for full onchain mode
├── lib/
│   ├── contract.ts      # Hybrid contract interaction
│   ├── pdf-utils.ts     # PDF utilities (sign, verify, embed QR)
│   ├── test-utils.ts    # Testing utilities
│   └── full/            # Utilities for full onchain mode
├── pages/
│   ├── Sign.tsx         # Sign page (hybrid)
│   ├── Verify.tsx       # Verify page (hybrid)
│   ├── Tests.tsx        # Testing page (optional)
│   ├── GenerateTampering.tsx  # Generate tampering page (optional)
│   └── full/            # Pages for full onchain mode
├── App.tsx              # Main application component
├── config.ts            # Application configuration
└── main.tsx             # Entry point
```

## 12. License

[MIT License](LICENSE)
