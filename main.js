// main.js - Application entry point (FIXED)
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
  
  // Wait a bit for wallet extensions to inject
  console.log('⏳ Waiting for wallet extensions to load...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check what's available
  console.log('🔍 Checking window objects:');
  console.log('  - LeatherProvider:', typeof window.LeatherProvider);
  console.log('  - HiroWalletProvider:', typeof window.HiroWalletProvider);
  console.log('  - XverseProviders:', typeof window.XverseProviders);
  
  // Initialize wallet manager (it has its own wait logic)
  console.log('👛 Initializing wallet manager...');
  await walletManager.waitForWallets();
  
  // Initialize UI controller
  console.log('🎨 Initializing UI controller...');
  await uiController.init();
  
  // Set up Farcaster Frame metadata if enabled
  if (CONFIG.FARCASTER.ENABLED) {
    setupFarcasterFrame();
  }
  
  console.log('===============================================');
  console.log('✅ APP INITIALIZED SUCCESSFULLY');
  console.log('===============================================');
  
  // Log wallet availability
  const availability = walletManager.checkAvailability();
  console.log('📋 Final wallet check:', availability);
  
  if (!availability.leather && !availability.xverse) {
    console.warn('⚠️ WARNING: No wallets detected!');
    console.warn('   Please install Leather or Xverse wallet extension');
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

  // Add meta tags to head
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

// Global error handler
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

// Debug helper - expose to window for manual testing
window.debugWallet = {
  checkProviders: () => {
    console.log('=== WALLET PROVIDERS DEBUG ===');
    console.log('LeatherProvider:', window.LeatherProvider);
    console.log('HiroWalletProvider:', window.HiroWalletProvider);
    console.log('XverseProviders:', window.XverseProviders);
    console.log('WalletManager state:', walletManager.getState());
    console.log('==============================');
  },
  testLeather: async () => {
    console.log('🧪 Testing Leather connection...');
    try {
      await walletManager.connectLeather();
      console.log('✅ Leather test passed');
    } catch (error) {
      console.error('❌ Leather test failed:', error);
    }
  },
  testXverse: async () => {
    console.log('🧪 Testing Xverse connection...');
    try {
      await walletManager.connectXverse();
      console.log('✅ Xverse test passed');
    } catch (error) {
      console.error('❌ Xverse test failed:', error);
    }
  },
  testTip: async (amount) => {
    console.log('🧪 Testing tip transaction:', amount, 'STX');
    try {
      await walletManager.sendTip(amount);
      console.log('✅ Tip test passed');
    } catch (error) {
      console.error('❌ Tip test failed:', error);
    }
  }
};

console.log('💡 Debug tools available: window.debugWallet');
console.log('   - debugWallet.checkProviders() - Check wallet detection');
console.log('   - debugWallet.testLeather() - Test Leather connection');
console.log('   - debugWallet.testXverse() - Test Xverse connection');
console.log('   - debugWallet.testTip(0.1) - Test tip transaction');
