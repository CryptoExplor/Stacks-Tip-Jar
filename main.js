// main.js - Application entry point
// IMPORTANT: farcaster-sdk.js auto-initializes on import
import { getFarcasterContext, isInFarcaster, getSDK } from './farcaster-sdk.js';
import { CONFIG } from './config.js';
import { uiController } from './ui.js';
import { walletManager } from './wallet.js';

console.log('===============================================');
console.log('🚀 STACKS TIP JAR - STARTING');
console.log('===============================================');

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

async function initApp() {
  console.log('📱 Initializing Stacks Tip Jar...');
  console.log('🌐 Network:', CONFIG.NETWORK.DEFAULT);
  console.log('📝 Contract:', CONFIG.CONTRACT.ADDRESS);
  console.log('📦 Contract Name:', CONFIG.CONTRACT.NAME);
  
  // Check Farcaster status
  console.log('🔍 Checking Farcaster status...');
  const inFarcaster = isInFarcaster();
  console.log(inFarcaster ? '✅ Running in Farcaster' : 'ℹ️ Not in Farcaster');
  
  // Get Farcaster context if available
  if (inFarcaster) {
    try {
      const context = await getFarcasterContext();
      
      if (context?.user) {
        console.log('👤 Farcaster user:', context.user.username);
        console.log('📱 Farcaster FID:', context.user.fid);
        
        // Show welcome message
        setTimeout(() => {
          const statusEl = document.getElementById('status');
          if (statusEl) {
            statusEl.textContent = `Welcome @${context.user.username}! 👋`;
            statusEl.className = 'status show info';
            setTimeout(() => statusEl.classList.remove('show'), 5000);
          }
        }, 1000);
      }
    } catch (err) {
      console.log('ℹ️ Could not load Farcaster context:', err.message);
    }
  }
  
  // Wait for wallet extensions
  console.log('⏳ Waiting for wallet extensions...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check available wallets
  console.log('🔍 Checking window objects:');
  console.log('  - LeatherProvider:', typeof window.LeatherProvider);
  console.log('  - HiroWalletProvider:', typeof window.HiroWalletProvider);
  console.log('  - XverseProviders:', typeof window.XverseProviders);
  console.log('  - Farcaster SDK:', getSDK() ? '✅' : '❌');
  
  // Initialize wallet manager
  console.log('👛 Initializing wallet manager...');
  await walletManager.waitForWallets();
  
  // Initialize UI controller
  console.log('🎨 Initializing UI controller...');
  await uiController.init();
  
  // Set up Farcaster Frame metadata
  if (CONFIG.FARCASTER.ENABLED) {
    setupFarcasterFrame();
  }
  
  console.log('===============================================');
  console.log('✅ APP INITIALIZED SUCCESSFULLY');
  console.log('===============================================');
  
  // Log wallet availability
  const availability = walletManager.checkAvailability();
  console.log('📋 Wallet availability:', availability);
  
  if (!availability.leather && !availability.xverse) {
    console.warn('⚠️ WARNING: No wallets detected!');
    console.warn('   Install Leather or Xverse wallet extension');
  }
}

// Setup Farcaster Frame metadata
function setupFarcasterFrame() {
  const meta = {
    'fc:frame': CONFIG.FARCASTER.FRAME_VERSION,
    'fc:frame:image': CONFIG.APP.URL + '/og-image.png',
    'fc:frame:image:aspect_ratio': CONFIG.FARCASTER.IMAGE_ASPECT_RATIO,
    'fc:frame:button:1': 'Send Tip',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': CONFIG.APP.URL,
    'og:title': CONFIG.APP.NAME,
    'og:description': CONFIG.APP.DESCRIPTION,
    'og:image': CONFIG.APP.URL + '/og-image.png'
  };

  Object.entries(meta).forEach(([property, content]) => {
    const existing = document.querySelector(`meta[property="${property}"]`);
    
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      const metaTag = document.createElement('meta');
      metaTag.setAttribute('property', property);
      metaTag.setAttribute('content', content);
      document.head.appendChild(metaTag);
    }
  });
}

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled rejection:', event.reason);
});

// Debug tools
window.debugWallet = {
  checkProviders: () => {
    console.log('=== WALLET PROVIDERS DEBUG ===');
    console.log('LeatherProvider:', window.LeatherProvider);
    console.log('HiroWalletProvider:', window.HiroWalletProvider);
    console.log('XverseProviders:', window.XverseProviders);
    console.log('Farcaster SDK:', getSDK());
    console.log('Farcaster Status:', isInFarcaster());
    console.log('WalletManager:', walletManager.getState());
    console.log('==============================');
  },
  
  testLeather: async () => {
    console.log('🧪 Testing Leather...');
    try {
      await walletManager.connectLeather();
      console.log('✅ Leather test passed');
    } catch (error) {
      console.error('❌ Leather test failed:', error);
    }
  },
  
  testXverse: async () => {
    console.log('🧪 Testing Xverse...');
    try {
      await walletManager.connectXverse();
      console.log('✅ Xverse test passed');
    } catch (error) {
      console.error('❌ Xverse test failed:', error);
    }
  },
  
  testTip: async (amount) => {
    console.log('🧪 Testing tip:', amount, 'STX');
    try {
      await walletManager.sendTip(amount);
      console.log('✅ Tip test passed');
    } catch (error) {
      console.error('❌ Tip test failed:', error);
    }
  },
  
  testFarcaster: async () => {
    console.log('🧪 Testing Farcaster...');
    console.log('In Farcaster:', isInFarcaster());
    console.log('SDK:', getSDK());
    
    if (isInFarcaster()) {
      const context = await getFarcasterContext();
      console.log('Context:', context);
    }
  },
  
  callReady: () => {
    const { callReady } = require('./farcaster-sdk.js');
    return callReady();
  }
};

console.log('💡 Debug tools: window.debugWallet');
console.log('   - debugWallet.checkProviders()');
console.log('   - debugWallet.testLeather()');
console.log('   - debugWallet.testXverse()');
console.log('   - debugWallet.testTip(0.1)');
console.log('   - debugWallet.testFarcaster()');
console.log('   - debugWallet.callReady()');
