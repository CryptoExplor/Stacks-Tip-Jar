// wallet.js - Wallet connection and management (FIXED - No Buffer, proper error handling)
import { CONFIG } from './config.js';

export class WalletManager {
  constructor() {
    this.address = null;
    this.walletType = null;
    this.listeners = [];
    this.isReady = false;
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

  // Encode Clarity uint as hex (no Buffer needed)
  encodeClarityUint(microAmount) {
    const hex = microAmount.toString(16);
    const padded = hex.padStart(32, '0');
    return '0x01' + padded;
  }

  // Extract txId from response
  extractTxId(response) {
    if (!response) return null;
    
    // Direct txid/txId
    if (response.txid || response.txId) {
      return response.txid || response.txId;
    }
    
    // Nested in result
    if (response.result && (response.result.txid || response.result.txId)) {
      return response.result.txid || response.result.txId;
    }
    
    return null;
  }

  // Connect Leather wallet
  async connectLeather() {
    console.log('🔌 Attempting Leather connection...');
    
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
      
      const response = await stacksProvider.request('stx_getAccounts', {
        purposes: ['stx'],
        message: 'Connect to ' + CONFIG.APP.NAME
      });
      
      console.log('✅ Xverse response:', response);

      const address = response?.result?.accounts?.[0]?.address || 
                     response?.result?.addresses?.[0]?.address;

      if (!address) {
        throw new Error('No address returned from Xverse');
      }

      this.address = address;
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

  // Send tip via Leather - FIXED with no Buffer
  async sendTipLeather(microAmount) {
    console.log('🦊 Sending via Leather...');
    
    const provider = window.LeatherProvider || window.HiroWalletProvider;
    
    if (!provider) {
      throw new Error('Leather provider not found');
    }

    try {
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const argHex = this.encodeClarityUint(microAmount);
      
      console.log('📝 Contract:', contractId);
      console.log('🔢 Amount (micro):', microAmount);
      console.log('🔐 Hex-encoded argument:', argHex);
      
      const params = {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [argHex],
        network: CONFIG.NETWORK.DEFAULT
      };
      
      console.log('📤 Calling stx_callContract with params:', params);
      
      const response = await provider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);
      
      // Check for error in response
      if (response.error) {
        const errorMsg = response.error.message || 
                        response.error.toString() || 
                        'Transaction failed';
        throw new Error(errorMsg);
      }
      
      // Extract txid from response
      const txid = this.extractTxId(response);
      
      if (!txid) {
        throw new Error('No transaction ID returned from Leather');
      }
      
      return {
        success: true,
        txId: txid,
        walletType: 'leather'
      };
      
    } catch (error) {
      console.error('❌ Leather transaction failed:', error);
      
      // Better error message extraction
      let errorMessage = 'Transaction failed';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMessage = error.toString();
      }
      
      throw new Error(errorMessage);
    }
  }

  // Send tip via Xverse - FIXED with no Buffer
  async sendTipXverse(microAmount) {
    console.log('⚡ Sending via Xverse...');
    
    if (!window.XverseProviders) {
      throw new Error('Xverse provider not found');
    }

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const argHex = this.encodeClarityUint(microAmount);
      
      console.log('📝 Contract:', contractId);
      console.log('🔢 Amount (micro):', microAmount);
      console.log('🔐 Hex-encoded argument:', argHex);
      
      const params = {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [argHex],
        network: CONFIG.NETWORK.DEFAULT
      };
      
      console.log('📤 Calling stx_callContract with params:', params);
      
      const response = await stacksProvider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);
      
      // Check for error in response
      if (response.error) {
        const errorMsg = response.error.message || 
                        response.error.toString() || 
                        'Transaction failed';
        throw new Error(errorMsg);
      }
      
      // Extract txid from response
      const txid = this.extractTxId(response);
      
      if (!txid) {
        throw new Error('No transaction ID returned from Xverse');
      }
      
      return {
        success: true,
        txId: txid,
        walletType: 'xverse'
      };
      
    } catch (error) {
      console.error('❌ Xverse transaction failed:', error);
      
      // Better error message extraction
      let errorMessage = 'Transaction failed';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMessage = error.toString();
      }
      
      throw new Error(errorMessage);
    }
  }
}

// Export singleton instance
export const walletManager = new WalletManager();
