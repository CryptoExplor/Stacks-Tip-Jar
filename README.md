# Stacks Tip Jar ⚡ v2.0.1 - FIXED

A production-ready tip jar dApp built on Stacks (Bitcoin L2) with modular architecture, Farcaster Frame support, and Clarity 4 features.

![Stacks](https://img.shields.io/badge/Stacks-Blockchain-blueviolet)
![Clarity](https://img.shields.io/badge/Clarity-4.0-purple)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black)
![Version](https://img.shields.io/badge/version-2.0.1-blue)
![Status](https://img.shields.io/badge/status-FIXED-green)

## 🔧 What's Fixed in v2.0.1

### Critical Fixes
- ✅ **34-byte memo constants** - Fixed from 35 bytes to correct 34 bytes
- ✅ **Buffer polyfill** - Added vite-plugin-node-polyfills for browser compatibility
- ✅ **Network validation** - Validates wallet network matches app configuration
- ✅ **Transaction timeout** - Added 2-minute timeout for pending transactions
- ✅ **Post-conditions** - Implemented proper STX post-conditions for security
- ✅ **Faucet cooldown persistence** - Now survives page reloads via localStorage
- ✅ **Character counter** - Fixed off-by-one error (was allowing 281 chars)
- ✅ **History detection** - Better detection of contract history support
- ✅ **User stats loading** - Added premium status and progress tracking
- ✅ **Error handling** - Comprehensive try-catch blocks throughout
- ✅ **Safe localStorage** - Wrapped all localStorage calls in error handlers

### Contract Version
**Use `tip-jar-v4.clar`** - This is the ONLY contract you should deploy. Other versions included for reference only.

## ✨ Features

- 💸 **Accept Tips**: Receive STX tips from anyone with on-chain memos
- 💬 **Custom Messages**: Send tips with UTF-8 messages (Clarity 4)
- 🔐 **Secure**: Owner-only withdrawal with post-conditions
- 🎨 **Modern UI**: Clean, responsive design with gradient backgrounds
- 🦊 **Multi-Wallet**: Support for Leather and Xverse wallets
- 📊 **Real-time Stats**: Live contract balance and tip tracking
- 📜 **Transaction History**: Full on-chain transaction history
- 👑 **Premium Tippers**: Unlock premium status with 10+ STX in tips
- 🔗 **Farcaster Ready**: Built-in Frame support for social sharing
- ⚡ **Lightning Fast**: Modular ES6 architecture
- 🛡️ **Error Handling**: Comprehensive error management
- 📱 **Responsive**: Works on all devices

## 🏗️ Architecture

```
stacks-tip-jar/
├── index.html              # Main HTML entry point
├── styles.css              # Application styles
├── main.js                 # Application entry point
├── config.js               # Configuration and utilities (FIXED)
├── wallet.js               # Wallet connection management (FIXED)
├── contract.js             # Smart contract interactions
├── ui.js                   # UI controller and state (FIXED)
├── contracts/
│   └── tip-jar-v4.clar    # Clarity 4 contract (FIXED - USE THIS ONE)
├── package.json            # Project metadata (FIXED)
├── vite.config.js          # Vite config with polyfills (FIXED)
└── README.md               # This file (UPDATED)
```

## 🚀 Quick Start

### Prerequisites

- A Stacks wallet (Leather or Xverse)
- Node.js 18+ and npm 9+
- Basic knowledge of blockchain and cryptocurrencies

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/CryptoExplor/stacks-tip-jar.git
cd stacks-tip-jar
```

2. **Install dependencies** (IMPORTANT - includes polyfills)
```bash
npm install
```

3. **Deploy the smart contract**

- Go to [Stacks Explorer Sandbox](https://explorer.hiro.so/sandbox/deploy?chain=testnet)
- Copy code from `contracts/tip-jar-v4.clar` (ONLY use v4!)
- Deploy to testnet first for testing
- Save your contract address (starts with ST for testnet)

4. **Configure your contract**

Edit `config.js` and update:

```javascript
export const CONFIG = {
  CONTRACT: {
    ADDRESS: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG', // ⚠️ YOUR DEPLOYED ADDRESS
    NAME: 'tip-jar-v4', // ⚠️ MUST MATCH DEPLOYED CONTRACT NAME
    OWNER: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG' // ⚠️ YOUR ADDRESS
  },
  NETWORK: {
    DEFAULT: 'testnet', // Use 'testnet' first, then 'mainnet'
  }
  // ... rest stays the same
};
```

5. **Run locally**

```bash
npm run dev
```

Open http://localhost:8000

6. **Build for production**

```bash
npm run build
```

7. **Deploy to Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## 🎯 Usage

### For Users

1. Visit the deployed site
2. Click "Connect Wallet" and choose Leather or Xverse
3. Approve the connection in your wallet
4. Enter a tip amount or use quick amounts
5. (Optional) Add a custom message
6. Click "Send Tip" and confirm in your wallet
7. Transaction complete! 🎉

### For Contract Owner

The contract owner can withdraw accumulated tips:

```clarity
;; Call from Clarinet or Stacks Explorer
(contract-call? .tip-jar-v4 withdraw 'YOUR-ADDRESS)
```

## 🔧 Configuration

### Network Settings

Change network in `config.js`:

```javascript
NETWORK: {
  DEFAULT: 'testnet', // or 'mainnet'
}
```

**IMPORTANT**: Ensure your wallet is on the same network!

### UI Customization

Adjust settings in `config.js`:

```javascript
UI: {
  QUICK_AMOUNTS: [0.1, 0.5, 1, 5],
  MIN_TIP: 0.000001,
  MAX_TIP: 1000000,
  MAX_MESSAGE_LENGTH: 280
}
```

## 🎨 Clarity 4 Features

### 1. On-chain Memos (34 bytes)
Every tip and withdrawal includes an on-chain memo:
- Tips: "TIP RECEIVED!" 
- Withdrawals: "WITHDRAW OK"

### 2. Custom Messages (UTF-8, 280 chars)
Users can attach custom messages to tips:
```clarity
(send-tip-with-message u1000000 u"Thanks for the content!")
```

### 3. Transaction History
Full transaction history stored on-chain:
- Tipper address
- Amount
- Block height
- Message flag

### 4. Consensus Hashing
Uses `to-consensus-buff?` for additional data integrity.

### 5. STX Account Info
Access full STX account information via `stx-account`.

## 📊 Contract Functions

### Public Functions
- `send-tip (amount uint)` - Send a tip with memo
- `send-tip-with-message (amount uint) (message string-utf8)` - Send tip with custom message
- `withdraw (recipient principal)` - Withdraw tips (owner only)
- `transfer-ownership (new-owner principal)` - Transfer ownership
- `set-premium-threshold (new-threshold uint)` - Update premium threshold

### Read-Only Functions
- `get-owner` - Get contract owner
- `get-total-tips` - Get total tips received
- `get-contract-balance` - Get current balance
- `get-total-tippers` - Get unique tipper count
- `get-total-transactions` - Get transaction count
- `get-tipper-stats (tipper principal)` - Get user statistics
- `get-transaction (tx-id uint)` - Get specific transaction
- `get-tip-message (tipper principal) (tip-id uint)` - Get tip message
- `is-premium-tipper (tipper principal)` - Check premium status
- `get-contract-summary` - Get all stats at once

## 🔐 Security Features

- ✅ Post-conditions on all STX transfers
- ✅ Owner-only withdrawal mechanism
- ✅ Input validation on all transactions
- ✅ Secure wallet connection handling
- ✅ No private key exposure
- ✅ Network validation
- ✅ Transaction timeouts
- ✅ XSS protection headers

## 🐛 Troubleshooting

### "Wallet on wrong network"
**Solution**: Switch your wallet to match `CONFIG.NETWORK.DEFAULT`:
- Testnet: Addresses start with ST
- Mainnet: Addresses start with SP

### "Transaction timeout"
**Solution**: Check your wallet for a pending approval popup. Timeout is 2 minutes.

### "Contract not found"
**Solution**: Verify in `config.js`:
```javascript
CONTRACT: {
  ADDRESS: 'ST...',  // ✅ Correct format
  NAME: 'tip-jar-v4', // ✅ Must match deployed name
}
```

### "Module import errors"
**Solution**: Must serve over HTTP, not file://
```bash
npm run dev  # Use Vite dev server
```

### "Buffer is not defined"
**Solution**: Ensure `vite-plugin-node-polyfills` is installed:
```bash
npm install vite-plugin-node-polyfills --save-dev
```

### Transaction History Not Showing
**Possible causes**:
1. Contract doesn't support history (not v4)
2. No transactions yet (shows "No tips yet")
3. Contract call failed (check console)

**Solution**: Deploy `tip-jar-v4.clar` which includes full history support.

## 📝 Development

### Adding Features

The modular structure makes it easy:

1. **New wallet**: Extend `WalletManager` in `wallet.js`
2. **Contract functions**: Add to `ContractManager` in `contract.js`
3. **UI enhancements**: Modify `UIController` in `ui.js`
4. **Configuration**: Update `config.js`

### Code Quality

```bash
# Format code (if using Prettier)
npm run format

# Type check (if using TypeScript)
npm run type-check

# Lint (if using ESLint)
npm run lint
```

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built on [Stacks](https://stacks.co) - Bitcoin L2
- Wallet integrations: [Leather](https://leather.io), [Xverse](https://xverse.app)
- API: [Hiro Systems](https://hiro.so)

## 📞 Support

- GitHub Issues: [Report a bug](https://github.com/CryptoExplor/stacks-tip-jar/issues)
- Twitter: [@kumar14700](https://twitter.com/kumar14700)

---

**Built with ❤️ on Stacks • Secured by Bitcoin • Enhanced with Clarity 4**

**Version**: 2.0.1 (All Critical Issues Fixed)

Tip Address: `ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG`
