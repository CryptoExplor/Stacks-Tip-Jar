# Deployment Guide

Complete step-by-step guide to deploy your Stacks Tip Jar.

## 📋 Prerequisites

- GitHub account
- Vercel account (free tier works)
- Stacks wallet (Leather or Xverse)
- Testnet STX (get from [faucet](https://explorer.hiro.so/sandbox/faucet))

## 🔧 Step 1: Deploy Smart Contract

### Option A: Hiro Explorer (Recommended)

1. Visit [Stacks Explorer Sandbox](https://explorer.hiro.so/sandbox/deploy?chain=testnet)

2. Connect your wallet (Leather or Xverse)

3. Copy the contract code from `contracts/tip-jar.clar`

4. Paste into the contract code field

5. Set contract name: `tip-jar`

6. Click "Deploy" and confirm in your wallet

7. Wait for confirmation (~10 minutes on testnet)

8. **Save your contract address!** Format: `ST...YOUR-ADDRESS`

### Option B: Clarinet CLI

```bash
# Install Clarinet
brew install clarinet

# Initialize project
clarinet new tip-jar-project
cd tip-jar-project

# Copy your contract
cp /path/to/tip-jar.clar contracts/

# Test locally
clarinet check

# Deploy to testnet
clarinet deploy --testnet
```

## 📝 Step 2: Configure Your App

1. Open `config.js` in your project

2. Update the contract address:

```javascript
export const CONFIG = {
  CONTRACT: {
    ADDRESS: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG', // ✅ Your address here
    NAME: 'tip-jar',
    OWNER: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG'
  },
  NETWORK: {
    DEFAULT: 'testnet', // Use 'testnet' for testing
    // ...
  }
};
```

3. Update `index.html` meta tags:

```html
<!-- Update these URLs -->
<meta property="og:url" content="https://your-domain.vercel.app" />
<meta property="og:image" content="https://your-domain.vercel.app/og-image.png" />
```

## 🚀 Step 3: Deploy to Vercel

### Option A: Vercel CLI (Fastest)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd stacks-tip-jar
vercel

# Follow prompts:
# - Project name: stacks-tip-jar
# - Directory: ./
# - Build command: (leave empty)
# - Output directory: (leave empty)

# Deploy to production
vercel --prod
```

### Option B: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)

2. Click "New Project"

3. Import from GitHub:
   - Click "Import Git Repository"
   - Authorize Vercel to access your GitHub
   - Select your `stacks-tip-jar` repository

4. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)

5. Click "Deploy"

6. Wait for deployment (~30 seconds)

7. Visit your site: `https://your-project.vercel.app`

## 🎨 Step 4: Create OG Image (Optional)

For better social sharing and Farcaster Frames:

1. Create a 1200x1200px image (PNG or JPEG)

2. Name it `og-image.png`

3. Place in project root directory

4. Commit and push to GitHub

5. Vercel will automatically redeploy

**Design tips:**
- Include your app name: "Stacks Tip Jar"
- Add Bitcoin/Stacks logo
- Use brand colors
- Keep text readable at small sizes

## 🔗 Step 5: Set Up Custom Domain (Optional)

### On Vercel:

1. Go to your project dashboard

2. Click "Settings" → "Domains"

3. Add your domain: `tipjar.yourdomain.com`

4. Follow DNS configuration instructions

5. Update `config.js` with your new domain:

```javascript
APP: {
  URL: 'https://tipjar.yourdomain.com'
}
```

## ✅ Step 6: Test Your Deployment

### Pre-flight Checklist:

- [ ] Site loads without errors
- [ ] Wallet connection works (Leather/Xverse)
- [ ] Contract stats load correctly
- [ ] Can send test tip transaction
- [ ] Transaction appears in wallet history
- [ ] Stats refresh after tip
- [ ] Responsive on mobile
- [ ] OG image displays on social media

### Testing Steps:

1. **Load Test**
   - Open your deployed URL
   - Check browser console for errors
   - Verify all assets load

2. **Wallet Test**
   - Click "Connect Wallet"
   - Connect Leather or Xverse
   - Verify address displays correctly

3. **Stats Test**
   - Check contract balance loads
   - Click "Refresh Stats"
   - Verify data updates

4. **Transaction Test**
   - Enter 0.1 STX tip
   - Click "Send Tip"
   - Confirm in wallet
   - Wait for confirmation
   - Verify stats update

5. **Mobile Test**
   - Open on mobile device
   - Test wallet connection
   - Verify UI is responsive

## 🐛 Troubleshooting

### Contract not found

```javascript
// In config.js, verify:
CONTRACT: {
  ADDRESS: 'ST...',  // ✅ Correct format
  NAME: 'tip-jar',   // ✅ Exact contract name
}
```

### CORS errors

Ensure you're using correct RPC endpoints:
- Testnet: `https://api.testnet.hiro.so`
- Mainnet: `https://api.hiro.so`

### Wallet won't connect

1. Install wallet extension
2. Create/import wallet
3. Switch to correct network (testnet/mainnet)
4. Reload page

### Module import errors

Ensure serving over HTTP, not `file://`:
```bash
# Correct way to test locally
python3 -m http.server 8000
# Then visit http://localhost:8000
```

### Vercel deployment fails

Check `vercel.json` is valid JSON:
```bash
# Validate JSON
cat vercel.json | python3 -m json.tool
```

## 📊 Post-Deployment

### Monitor Your App

1. **Vercel Analytics**
   - Enable in project settings
   - Monitor page views, performance

2. **Contract Activity**
   - Check [Stacks Explorer](https://explorer.hiro.so)
   - Search for your contract address
   - View transaction history

3. **Error Tracking**
   - Set up [Sentry](https://sentry.io) (optional)
   - Add to `main.js`:

```javascript
// Optional: Add Sentry
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

### Share Your App

- Twitter/X: Share with #Stacks #Bitcoin hashtags
- Farcaster: Post with Frame support
- Discord: Stacks community channels
- GitHub: Add to Stacks ecosystem list

## 🔄 Updating Your App

### Update Process:

1. Make changes locally
2. Test with `python3 -m http.server`
3. Commit to GitHub
4. Vercel auto-deploys from main branch

### For contract updates:

1. Deploy new contract version
2. Update `CONTRACT.ADDRESS` in `config.js`
3. Push to GitHub
4. Vercel redeploys automatically

## 🎉 Going to Mainnet

When ready for production:

1. **Deploy contract to mainnet**
   - Use Hiro Explorer with mainnet selected
   - Requires real STX (not testnet)

2. **Update config.js**
```javascript
NETWORK: {
  DEFAULT: 'mainnet', // ✅ Change from testnet
}
```

3. **Update contract address**
```javascript
CONTRACT: {
  ADDRESS: 'SP...', // ✅ Mainnet address (starts with SP)
  NAME: 'tip-jar',
  OWNER: 'SP...'
}
```

4. **Push to GitHub**
   - Vercel will auto-deploy to mainnet

5. **Test thoroughly**
   - Send small test tip first
   - Verify all functionality

## 📞 Support

If you need help:

- GitHub Issues: Report bugs/problems
- Stacks Discord: Community support
- Twitter: Tag @Stacks for visibility

---

**Congratulations! Your Stacks Tip Jar is now live! 🎉**

Share your deployment:
```
Check out my Stacks Tip Jar! ⚡
Built on Bitcoin L2 with @Stacks
https://your-domain.vercel.app
```
