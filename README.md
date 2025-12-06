# Stacks Tip Jar ⚡

A minimal dApp built on Stacks (Bitcoin L2) that allows anyone to send you STX tips, which you can withdraw as the contract owner.

![Stacks](https://img.shields.io/badge/Stacks-Blockchain-blueviolet)
![Clarity](https://img.shields.io/badge/Clarity-Smart%20Contract-purple)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black)

## Features

- 💸 **Accept Tips**: Anyone can send you STX tips
- 🔐 **Secure Withdrawal**: Only contract owner can withdraw
- 🌐 **Web Interface**: Clean, responsive UI
- 🔗 **Wallet Integration**: Connect with Leather/Hiro wallet
- ⚡ **Bitcoin-Secured**: Built on Stacks L2

## Tech Stack

- **Smart Contract**: Clarity (Stacks)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Wallet**: Stacks Connect SDK
- **Deployment**: Vercel

## Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/yourusername/stacks-tip-jar.git
cd stacks-tip-jar
```

### 2. Deploy Smart Contract

1. Go to [Stacks Explorer Sandbox](https://explorer.hiro.so/sandbox/deploy)
2. Copy the contract code from `contracts/tip-jar.clar`
3. Paste it and click "Deploy"
4. Save your contract address and name

### 3. Configure Frontend

Edit `public/index.html` and replace:

```javascript
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";
const CONTRACT_NAME = "tip-jar";
const NETWORK = "testnet"; // or "mainnet"
```

### 4. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
npm install -g vercel
vercel
```

#### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Connect your GitHub repository
4. Click "Deploy"

That's it! Your tip jar is live 🚀

## Project Structure

```
stacks-tip-jar/
├── contracts/
│   └── tip-jar.clar       # Clarity smart contract
├── public/
│   └── index.html         # Frontend web app
├── vercel.json            # Vercel deployment config
├── package.json           # Project metadata
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Usage

1. Visit your deployed site
2. Click "Connect Wallet"
3. Approve connection in your Stacks wallet
4. Enter amount and click "Send Tip"
5. Confirm transaction in wallet

## Contract Functions

### Public Functions

- `send-tip (amount uint)` - Send a tip to the contract
- `withdraw (recipient principal)` - Withdraw all tips (owner only)
- `transfer-ownership (new-owner principal)` - Transfer contract ownership (owner only)

### Read-Only Functions

- `get-owner` - Returns current contract owner
- `get-total-tips` - Returns total tips received
- `get-contract-balance` - Returns current contract balance

## Local Development

```bash
# Serve locally
cd public
python3 -m http.server 3000
# Visit http://localhost:3000
```

## Customization Ideas

- Add tip leaderboard
- Show recent tippers
- Add custom thank you messages
- Create tip tiers with rewards
- Add social media links
- Integrate with Twitter/Discord bots

## Stacks Builder Challenge

This project is perfect for the Stacks Builder Challenge:

- ✅ Open source on GitHub
- ✅ Uses Clarity smart contract
- ✅ Deployed on Stacks blockchain
- ✅ Has functional frontend
- ✅ Real on-chain activity

## License

MIT

## Support

If you found this helpful, send a tip! 😊

---

**Built with ❤️ on Stacks**
