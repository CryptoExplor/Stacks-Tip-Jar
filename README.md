# Stacks Tip Jar ⚡ v2.0

A fully refactored, production-ready tip jar dApp built on Stacks (Bitcoin L2) with modular architecture, Farcaster Frame support, and enhanced error handling.

![Stacks](https://img.shields.io/badge/Stacks-Blockchain-blueviolet)
![Clarity](https://img.shields.io/badge/Clarity-Smart%20Contract-purple)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black)
![Version](https://img.shields.io/badge/version-2.0.0-blue)

## ✨ Features

- 💸 **Accept Tips**: Receive STX tips from anyone
- 🔐 **Secure**: Owner-only withdrawal functionality
- 🎨 **Modern UI**: Clean, responsive design with gradient backgrounds
- 🦊 **Multi-Wallet**: Support for Leather and Xverse wallets
- 📊 **Real-time Stats**: Live contract balance and tip tracking
- 🔗 **Farcaster Ready**: Built-in Frame support for social sharing
- ⚡ **Lightning Fast**: Modular ES6 architecture
- 🛡️ **Error Handling**: Comprehensive error management
- 📱 **Responsive**: Works on all devices

## 🏗️ Architecture

### Modular Structure

```
stacks-tip-jar/
├── index.html          # Main HTML entry point
├── styles.css          # Application styles
├── main.js            # Application entry point
├── config.js          # Configuration and utilities
├── wallet.js          # Wallet connection management
├── contract.js        # Smart contract interactions
├── ui.js              # UI controller and state management
├── contracts/
│   └── tip-jar.clar   # Clarity smart contract
├── package.json       # Project metadata
├── vercel.json        # Vercel deployment config
└── README.md          # This file
```

### Module Responsibilities

- **config.js**: Central configuration, utility functions, network settings
- **wallet.js**: Wallet connection, transaction signing, state management
- **contract.js**: Contract queries, data fetching, response parsing
- **ui.js**: DOM manipulation, event handling, user feedback
- **main.js**: Application initialization and coordination

## 🚀 Quick Start

### Prerequisites

- A Stacks wallet (Leather or Xverse)
- Basic knowledge of blockchain and cryptocurrencies

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/CryptoExplor/stacks-tip-jar.git
cd stacks-tip-jar
```

2. **Configure your contract**

Edit `config.js` and update the contract address:

```javascript
export const CONFIG = {
  CONTRACT: {
    ADDRESS: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG', // Your deployed contract
    NAME: 'tip-jar-v2',
    OWNER: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG'
  },
  // ... rest of config
};
```

3. **Deploy the smart contract**

- Go to [Stacks Explorer Sandbox](https://explorer.hiro.so/sandbox/deploy?chain=testnet)
- Copy code from `contracts/tip-jar-v2.clar`
- Deploy to testnet or mainnet
- Save your contract address

4. **Run locally**

```bash
# Using Python
python3 -m http.server 8000

# Then open http://localhost:8000
```

5. **Deploy to Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Or use the Vercel dashboard:
- Import your GitHub repository
- Deploy automatically

## 🎯 Usage

### For Users

1. Visit the deployed site
2. Click "Connect Wallet" and choose Leather or Xverse
3. Approve the connection in your wallet
4. Enter a tip amount or use quick amounts
5. Click "Send Tip" and confirm in your wallet
6. Transaction complete! 🎉

### For Contract Owner

The contract owner can withdraw accumulated tips:

```clarity
;; Call from Clarinet or Stacks Explorer
(contract-call? .tip-jar withdraw 'YOUR-ADDRESS)
```

## 🔧 Configuration

### Network Settings

Change network in `config.js`:

```javascript
NETWORK: {
  DEFAULT: 'testnet', // or 'mainnet'
  ENDPOINTS: {
    mainnet: 'https://api.hiro.so',
    testnet: 'https://api.testnet.hiro.so'
  }
}
```

### UI Customization

Adjust quick tip amounts in `config.js`:

```javascript
UI: {
  QUICK_AMOUNTS: [0.1, 0.5, 1, 5], // Your custom amounts
  MIN_TIP: 0.000001,
  DECIMALS: 6
}
```

### Styling

Edit `styles.css` to customize colors, fonts, and layout:

```css
:root {
  --primary: #667eea;
  --secondary: #764ba2;
  /* Add your custom colors */
}
```

## 🎨 Farcaster Frame Support

The app includes built-in Farcaster Frame metadata for social sharing:

```html
<meta property="fc:frame" content="vNext" />
<meta property="fc:frame:image" content="https://your-domain.vercel.app/og-image.png" />
<meta property="fc:frame:button:1" content="Send Tip" />
```

To customize:
1. Create an `og-image.png` (1200x1200px recommended)
2. Update the Frame metadata in `index.html`
3. Configure in `config.js`:

```javascript
FARCASTER: {
  ENABLED: true,
  FRAME_VERSION: 'vNext',
  IMAGE_ASPECT_RATIO: '1:1'
}
```

## 📝 Smart Contract

### Functions

**Public Functions:**
- `send-tip (amount uint)` - Send a tip
- `withdraw (recipient principal)` - Withdraw tips (owner only)
- `transfer-ownership (new-owner principal)` - Transfer ownership

**Read-Only Functions:**
- `get-owner` - Get contract owner
- `get-total-tips` - Get total tips received
- `get-contract-balance` - Get current balance

### Error Codes

- `u100` - Invalid amount (must be > 0)
- `u101` - No balance to withdraw
- `u401` - Unauthorized (not owner)

## 🔐 Security Features

- Owner-only withdrawal mechanism
- Input validation on all transactions
- Secure wallet connection handling
- No private key exposure
- XSS protection headers
- CORS-safe API calls

## 🛠️ Development

### Adding Features

The modular structure makes it easy to add features:

1. **New wallet support**: Extend `WalletManager` in `wallet.js`
2. **Additional contract functions**: Add to `ContractManager` in `contract.js`
3. **UI enhancements**: Modify `UIController` in `ui.js`
4. **Configuration**: Update `config.js`

### Example: Adding a new wallet

```javascript
// In wallet.js
async connectNewWallet() {
  if (typeof window.NewWalletProvider === 'undefined') {
    throw new Error('NewWallet not installed');
  }
  
  // Implementation here
  this.walletType = 'newwallet';
  this.notify();
}
```

## 🐛 Troubleshooting

### Common Issues

**Wallet won't connect:**
- Ensure wallet extension is installed and unlocked
- Check network matches (testnet/mainnet)
- Clear browser cache and reload

**Transaction fails:**
- Verify contract address in `config.js`
- Check you have enough STX for transaction + fees
- Ensure wallet is on correct network

**Stats not loading:**
- Verify contract is deployed
- Check network endpoint in `config.js`
- Open browser console for detailed errors

**Module import errors:**
- Ensure you're serving over HTTP (not file://)
- Check all `.js` files have correct relative paths
- Use `python3 -m http.server` for local testing

## 📊 Performance

- **Load time**: < 1s on modern connections
- **Bundle size**: ~25KB (uncompressed)
- **Dependencies**: Zero npm dependencies
- **Browser support**: Modern browsers (ES6+)

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

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

**Built with ❤️ on Stacks • Secured by Bitcoin**

Tip Address: `ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG`
