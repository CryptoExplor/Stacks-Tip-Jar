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
```

---

## Deployment Instructions

### Step 1: Create GitHub Repository

1. Go to GitHub and create new repo: `stacks-tip-jar`
2. Clone it locally
3. Create the folder structure and copy all files above
4. Commit and push:

```bash
git add .
git commit -m "Initial commit: Stacks Tip Jar dApp"
git push origin main
```

### Step 2: Deploy Contract

1. Install [Leather Wallet](https://leather.io/) or [Hiro Wallet](https://wallet.hiro.so/)
2. Get testnet STX from [faucet](https://explorer.hiro.so/sandbox/faucet)
3. Go to [Stacks Explorer Sandbox](https://explorer.hiro.so/sandbox/deploy)
4. Paste contract from `contracts/tip-jar.clar`
5. Click "Deploy Contract"
6. Save your contract address!

### Step 3: Update Frontend

Edit `public/index.html` lines 256-258:

```javascript
const CONTRACT_ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"; // Your address
const CONTRACT_NAME = "tip-jar";
const NETWORK = "testnet";
```

### Step 4: Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Root Directory: `./`
4. Output Directory: `public`
5. Click "Deploy"

Done! 🎉

## Next Steps

1. Test the tip jar with testnet STX
2. Make small improvements and commit daily for leaderboard activity
3. Switch to mainnet when ready
4. Share your tip jar link!
