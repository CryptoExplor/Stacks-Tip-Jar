// main.js - Application entry point
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
  
  // Wait for wallet extensions
  console.log('⏳ Waiting for wallet extensions...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check available wallets
  console.log('🔍 Checking window objects:');
  console.log('  - LeatherProvider:', typeof window.LeatherProvider);
  console.log('  - HiroWalletProvider:', typeof window.HiroWalletProvider);
  console.log('  - XverseProviders:', typeof window.XverseProviders);
  
  // Initialize wallet manager
  console.log('👛 Initializing wallet manager...');
  await walletManager.waitForWallets();
  
  // Initialize UI controller
  console.log('🎨 Initializing UI controller...');
  await uiController.init();
  
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
  }
};

console.log('💡 Debug tools: window.debugWallet');
console.log('   - debugWallet.checkProviders()');
console.log('   - debugWallet.testLeather()');
console.log('   - debugWallet.testXverse()');
console.log('   - debugWallet.testTip(0.1)');
