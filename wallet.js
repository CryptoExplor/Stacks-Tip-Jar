// wallet.js - Wallet connection and management (FULLY FIXED)
import { CONFIG, isValidStacksAddress } from './config.js';

export class WalletManager {
  constructor() {
    this.address = null;
    this.walletType = null;
    this.listeners = [];
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
      leather: typeof window.LeatherProvider !== 'undefined',
      xverse: typeof window.XverseProviders !== 'undefined',
      hiro: typeof window.HiroWalletProvider !== 'undefined'
    };
  }

  // Connect Leather wallet
  async connectLeather() {
    if (typeof window.LeatherProvider === 'undefined') {
      throw new Error('Leather wallet not installed');
    }

    try {
      const response = await window.LeatherProvider.request('getAddresses');
      
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
      this.notify();

      return {
        success: true,
        address: this.address,
        walletType: this.walletType
      };
    } catch (error) {
      console.error('Leather connection error:', error);
      throw error;
    }
  }

  // Connect Xverse wallet
  async connectXverse() {
    if (typeof window.XverseProviders === 'undefined') {
      throw new Error('Xverse wallet not installed');
    }

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      const response = await stacksProvider.request('getAddresses', {
        purposes: ['stacks'],
        message: 'Connect to ' + CONFIG.APP.NAME
      });

      if (!response.result?.addresses?.[0]?.address) {
        throw new Error('No address returned from Xverse');
      }

      this.address = response.result.addresses[0].address;
      this.walletType = 'xverse';
      this.notify();

      return {
        success: true,
        address: this.address,
        walletType: this.walletType
      };
    } catch (error) {
      console.error('Xverse connection error:', error);
      throw error;
    }
  }

  // Disconnect wallet
  disconnect() {
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
    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid tip amount');
    }

    const microAmount = Math.floor(amount * 1_000_000);

    try {
      if (this.walletType === 'leather') {
        return await this.sendTipLeather(microAmount);
      } else if (this.walletType === 'xverse') {
        return await this.sendTipXverse(microAmount);
      } else {
        throw new Error('Unknown wallet type');
      }
    } catch (error) {
      console.error('Send tip error:', error);
      throw error;
    }
  }

  // Send tip via Leather - CORRECTED with proper format
  async sendTipLeather(microAmount) {
    console.log('Sending tip via Leather:', microAmount);
    
    try {
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      
      // According to Leather docs, functionArgs should be hex-encoded strings
      // For a uint, we pass it as a string with 'u' prefix
      const response = await window.LeatherProvider.request('stx_callContract', {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [`u${microAmount}`], // Pass as string array
      });

      console.log('Leather response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      return {
        success: true,
        txId: response.result?.txid || response.result?.txId,
        walletType: 'leather'
      };
    } catch (error) {
      console.error('Leather transaction error:', error);
      throw error;
    }
  }

  // Send tip via Xverse - CORRECTED with proper format
  async sendTipXverse(microAmount) {
    console.log('Sending tip via Xverse:', microAmount);
    
    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      
      // For Xverse, functionArgs should be hex-encoded strings
      // We'll use the same format as Leather
      const response = await stacksProvider.request('stx_callContract', {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [`u${microAmount}`], // Pass as string array
      });

      console.log('Xverse response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      return {
        success: true,
        txId: response.result?.txid || response.result?.txId || response.result,
        walletType: 'xverse'
      };
    } catch (error) {
      console.error('Xverse transaction error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const walletManager = new WalletManager();
