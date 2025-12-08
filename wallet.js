// wallet.js - Wallet connection and management (TIMING FIX)
import { CONFIG } from './config.js';

export class WalletManager {
  constructor() {
    this.address = null;
    this.walletType = null;
    this.listeners = [];
    this.isReady = false;
    this.waitForWallets();
  }

  // Wait for wallet providers to load
  async waitForWallets() {
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      const availability = this.checkAvailability();
      if (availability.leather || availability.xverse) {
        this.isReady = true;
        console.log('✅ Wallets detected:', availability);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    console.log('⚠️ No wallets detected after timeout');
    this.isReady = true;
  }

  // Subscribe to wallet state changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners
  notify() {
    this.listeners.forEach(cb => cb({
      address: this.address,
      walletType: this.walletType,
      connected: !!this.address
    }));
  }

  // Check if wallets are available
  checkAvailability() {
    return {
      leather: typeof window.LeatherProvider !== 'undefined' || 
               typeof window.HiroWalletProvider !== 'undefined',
      xverse: typeof window.XverseProviders !== 'undefined'
    };
  }

  // Connect Leather wallet
  async connectLeather() {
    console.log('🔌 Attempting Leather connection...');
    
    // Check for Leather or Hiro wallet
    const provider = window.LeatherProvider || window.HiroWalletProvider;
    
    if (!provider) {
      throw new Error('Leather wallet not installed. Please install from leather.io');
    }

    try {
      console.log('📡 Requesting addresses from Leather...');
      const response = await provider.request('getAddresses');
      console.log('✅ Leather response:', response);
      
      if (!response.result?.addresses) {
        throw new Error('No addresses returned from Leather');
      }

      const addresses = response.result.addresses;
      const network = CONFIG.NETWORK.DEFAULT;
      
      // Find matching Stacks address for network
      const stacksAddress = addresses.find(addr => {
        if (addr.symbol !== 'STX') return false;
        if (network === 'testnet') {
          return addr.address.startsWith('ST');
        } else {
          return addr.address.startsWith('SP');
        }
      });
      
      // Fallback to any STX address
      const fallbackAddress = addresses.find(addr => addr.symbol === 'STX');
      const finalAddress = stacksAddress || fallbackAddress;

      if (!finalAddress) {
        throw new Error('No Stacks address found in wallet');
      }

      this.address = finalAddress.address;
      this.walletType = 'leather';
      console.log('✅ Connected:', this.address);
      this.notify();

      return {
        success: true,
        address: this.address,
        walletType: this.walletType
      };
    } catch (error) {
      console.error('❌ Leather connection error:', error);
      throw error;
    }
  }

  // Connect Xverse wallet
  async connectXverse() {
    console.log('🔌 Attempting Xverse connection...');
    
    if (typeof window.XverseProviders === 'undefined') {
      throw new Error('Xverse wallet not installed. Please install from xverse.app');
    }

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      console.log('📡 Requesting addresses from Xverse...');
      
      const response = await stacksProvider.request('getAddresses', {
        purposes: ['stacks'],
        message: 'Connect to ' + CONFIG.APP.NAME
      });
      
      console.log('✅ Xverse response:', response);

      if (!response.result?.addresses?.[0]?.address) {
        throw new Error('No address returned from Xverse');
      }

      this.address = response.result.addresses[0].address;
      this.walletType = 'xverse';
      console.log('✅ Connected:', this.address);
      this.notify();

      return {
        success: true,
        address: this.address,
        walletType: this.walletType
      };
    } catch (error) {
      console.error('❌ Xverse connection error:', error);
      throw error;
    }
  }

  // Disconnect wallet
  disconnect() {
    console.log('🔌 Disconnecting wallet...');
    this.address = null;
    this.walletType = null;
    this.notify();
  }

  // Get current state
  getState() {
    return {
      address: this.address,
      walletType: this.walletType,
      connected: !!this.address
    };
  }

  // Send tip transaction
  async sendTip(amount) {
    console.log('💸 Attempting to send tip:', amount, 'STX');
    
    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid tip amount');
    }

    const microAmount = Math.floor(amount * 1_000_000);
    console.log('💰 Micro amount:', microAmount);

    try {
      if (this.walletType === 'leather') {
        return await this.sendTipLeather(microAmount);
      } else if (this.walletType === 'xverse') {
        return await this.sendTipXverse(microAmount);
      } else {
        throw new Error('Unknown wallet type: ' + this.walletType);
      }
    } catch (error) {
      console.error('❌ Send tip error:', error);
      throw error;
    }
  }

  // Send tip via Leather
  async sendTipLeather(microAmount) {
    console.log('🦊 Sending via Leather...');
    
    const provider = window.LeatherProvider || window.HiroWalletProvider;
    
    if (!provider) {
      throw new Error('Leather provider not found');
    }

    try {
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      console.log('📝 Contract:', contractId);
      console.log('🔢 Function args:', [`u${microAmount}`]);
      
      const txOptions = {
        contractAddress: CONFIG.CONTRACT.ADDRESS,
        contractName: CONFIG.CONTRACT.NAME,
        functionName: 'send-tip',
        functionArgs: [`u${microAmount}`],
        network: CONFIG.NETWORK.DEFAULT,
        appDetails: {
          name: CONFIG.APP.NAME,
          icon: CONFIG.APP.URL + '/icon.png'
        },
        onFinish: (data) => {
          console.log('✅ Transaction finished:', data);
        },
        onCancel: () => {
          console.log('❌ Transaction cancelled');
        }
      };
      
      console.log('📤 Sending transaction request...');
      const response = await provider.request('stx_callContract', txOptions);
      console.log('📨 Provider response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      return {
        success: true,
        txId: response.result?.txid || response.result?.txId || response.result,
        walletType: 'leather'
      };
    } catch (error) {
      console.error('❌ Leather transaction failed:', error);
      throw error;
    }
  }

  // Send tip via Xverse
  async sendTipXverse(microAmount) {
    console.log('⚡ Sending via Xverse...');
    
    if (!window.XverseProviders) {
      throw new Error('Xverse provider not found');
    }

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      console.log('📝 Contract:', contractId);
      console.log('🔢 Function args:', [`u${microAmount}`]);
      
      console.log('📤 Sending transaction request...');
      const response = await stacksProvider.request('stx_callContract', {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [`u${microAmount}`]
      });
      
      console.log('📨 Provider response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      return {
        success: true,
        txId: response.result?.txid || response.result?.txId || response.result,
        walletType: 'xverse'
      };
    } catch (error) {
      console.error('❌ Xverse transaction failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const walletManager = new WalletManager();
