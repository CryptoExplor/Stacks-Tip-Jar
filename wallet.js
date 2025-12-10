// wallet.js - Wallet connection and management (FIXED VERSION)
import { CONFIG } from './config.js';
import { uintCV, cvToHex, standardPrincipalCV } from '@stacks/transactions';

export class WalletManager {
  constructor() {
    this.address = null;
    this.walletType = null;
    this.listeners = [];
    this.isReady = false;
    this.lastFaucetClaim = null;
    
    // Load saved wallet state on initialization
    this.loadWalletState();
  }

  // Save wallet state to localStorage
  saveWalletState() {
    if (this.address && this.walletType) {
      const state = {
        address: this.address,
        walletType: this.walletType,
        timestamp: Date.now()
      };
      localStorage.setItem('stacks_wallet_state', JSON.stringify(state));
      console.log('💾 Saved wallet state:', state);
    }
  }

  // Load wallet state from localStorage
  loadWalletState() {
    try {
      const saved = localStorage.getItem('stacks_wallet_state');
      if (saved) {
        const state = JSON.parse(saved);
        
        // Check if state is less than 24 hours old
        const hoursSince = (Date.now() - state.timestamp) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          this.address = state.address;
          this.walletType = state.walletType;
          console.log('✅ Restored wallet state:', state);
          
          // Notify listeners after a short delay
          setTimeout(() => this.notify(), 100);
        } else {
          console.log('⚠️ Wallet state expired, clearing...');
          localStorage.removeItem('stacks_wallet_state');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load wallet state:', error);
      localStorage.removeItem('stacks_wallet_state');
    }
  }

  // Clear wallet state from localStorage
  clearWalletState() {
    localStorage.removeItem('stacks_wallet_state');
    console.log('🗑️ Cleared wallet state');
  }

  // Wait for wallet providers to load (browser only)
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
    this.listeners.forEach(cb =>
      cb({
        address: this.address,
        walletType: this.walletType,
        connected: !!this.address,
      }),
    );
  }

  // Check if wallets are available (SSR safe)
  checkAvailability() {
    if (typeof window === 'undefined') {
      return { leather: false, xverse: false };
    }

    return {
      leather:
        typeof window.LeatherProvider !== 'undefined' ||
        typeof window.HiroWalletProvider !== 'undefined',
      xverse: typeof window.XverseProviders !== 'undefined',
    };
  }

  // Encode Clarity uint as hex for stx_callContract
  encodeClarityUint(microAmount) {
    const cv = uintCV(microAmount);
    return cvToHex(cv);
  }

  // Encode principal as hex
  encodePrincipal(address) {
    const cv = standardPrincipalCV(address);
    return cvToHex(cv);
  }

  // Extract txId from various response shapes
  extractTxId(response) {
    if (!response) return null;

    if (response.txid || response.txId) {
      return response.txid || response.txId;
    }

    if (response.result && (response.result.txid || response.result.txId)) {
      return response.result.txid || response.result.txId;
    }

    return null;
  }

  // Connect Leather wallet
  async connectLeather() {
    console.log('🔌 Attempting Leather connection...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

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
      
      // Save wallet state
      this.saveWalletState();
      this.notify();

      return {
        success: true,
        address: this.address,
        walletType: this.walletType,
      };
    } catch (error) {
      console.error('❌ Leather connection error:', error);
      throw error;
    }
  }

  // Connect Xverse wallet
  async connectXverse() {
    console.log('🔌 Attempting Xverse connection...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

    if (typeof window.XverseProviders === 'undefined') {
      throw new Error('Xverse wallet not installed. Please install from xverse.app');
    }

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      console.log('📡 Requesting addresses from Xverse...');

      const response = await stacksProvider.request('stx_getAccounts', {
        purposes: ['stx'],
        message: 'Connect to ' + CONFIG.APP.NAME,
      });

      console.log('✅ Xverse response:', response);

      const address =
        response?.result?.accounts?.[0]?.address ||
        response?.result?.addresses?.[0]?.address;

      if (!address) {
        throw new Error('No address returned from Xverse');
      }

      this.address = address;
      this.walletType = 'xverse';
      console.log('✅ Connected:', this.address);
      
      // Save wallet state
      this.saveWalletState();
      this.notify();

      return {
        success: true,
        address: this.address,
        walletType: this.walletType,
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
    this.clearWalletState();
    this.notify();
  }

  // Get current state
  getState() {
    return {
      address: this.address,
      walletType: this.walletType,
      connected: !!this.address,
    };
  }

  async claimFaucet() {
    console.log('💰 Attempting to claim from faucet...');

    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    if (CONFIG.NETWORK.DEFAULT !== 'testnet') {
      throw new Error('Faucet is only available on testnet');
    }

    if (this.lastFaucetClaim) {
      const timeSince = Date.now() - this.lastFaucetClaim;
      if (timeSince < CONFIG.FAUCET.COOLDOWN) {
        const remainingSeconds = Math.ceil((CONFIG.FAUCET.COOLDOWN - timeSince) / 1000);
        throw new Error(`Please wait ${remainingSeconds} seconds before claiming again`);
      }
    }

    try {
      const url = `${CONFIG.FAUCET.ENDPOINT}?address=${this.address}&stacking=false`;
      console.log('📡 Calling faucet:', url);

      const response = await fetch(url, {
        method: 'POST'
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Faucet rate limit reached. Please try again later.');
        }
        
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.message || JSON.stringify(errorData);
        } catch {
          errorText = await response.text();
        }
        
        if (response.status === 500) {
          throw new Error('Faucet service temporarily unavailable. Try using the Hiro Explorer faucet directly.');
        }
        
        throw new Error(`Faucet request failed: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Faucet response:', data);

      this.lastFaucetClaim = Date.now();

      const txId = data.txId || data.txid;

      return {
        success: true,
        txId: txId,
        message: `Claimed ${CONFIG.FAUCET.AMOUNT} STX from faucet`,
      };
    } catch (error) {
      console.error('❌ Faucet claim failed:', error);
      throw error;
    }
  }

  canClaimFaucet() {
    if (!this.address || CONFIG.NETWORK.DEFAULT !== 'testnet') {
      return { canClaim: false, reason: 'Not connected or not on testnet' };
    }

    if (this.lastFaucetClaim) {
      const timeSince = Date.now() - this.lastFaucetClaim;
      if (timeSince < CONFIG.FAUCET.COOLDOWN) {
        const remainingSeconds = Math.ceil((CONFIG.FAUCET.COOLDOWN - timeSince) / 1000);
        return { 
          canClaim: false, 
          reason: `Wait ${remainingSeconds}s`,
          remainingSeconds 
        };
      }
    }

    return { canClaim: true };
  }

  async sendTip(amount) {
    console.log('💸 Attempting to send tip:', amount, 'STX');

    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
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

  async sendTipLeather(microAmount) {
    console.log('🦊 Sending via Leather...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

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
        postConditionMode: 'allow',
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract with params:', params);

      const response = await provider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        const errorMsg =
          response.error.message ||
          response.error.toString() ||
          'Transaction failed';
        throw new Error(errorMsg);
      }

      const txid = this.extractTxId(response);

      if (!txid) {
        throw new Error('No transaction ID returned from Leather');
      }

      return {
        success: true,
        txId: txid,
        walletType: 'leather',
      };
    } catch (error) {
      console.error('❌ Leather transaction failed:', error);

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

  async sendTipXverse(microAmount) {
    console.log('⚡ Sending via Xverse...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

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
        postConditionMode: 'allow',
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract with params:', params);

      const response = await stacksProvider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        const errorMsg =
          response.error.message ||
          response.error.toString() ||
          'Transaction failed';
        throw new Error(errorMsg);
      }

      const txid = this.extractTxId(response);

      if (!txid) {
        throw new Error('No transaction ID returned from Xverse');
      }

      return {
        success: true,
        txId: txid,
        walletType: 'xverse',
      };
    } catch (error) {
      console.error('❌ Xverse transaction failed:', error);

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

  async withdraw() {
    console.log('⬇️ Attempting withdrawal...');

    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    if (this.address !== CONFIG.CONTRACT.OWNER) {
      throw new Error('Only the contract owner can withdraw');
    }

    try {
      if (this.walletType === 'leather') {
        return await this.withdrawLeather(this.address);
      } else if (this.walletType === 'xverse') {
        return await this.withdrawXverse(this.address);
      } else {
        throw new Error('Unknown wallet type: ' + this.walletType);
      }
    } catch (error) {
      console.error('❌ Withdraw error:', error);
      throw error;
    }
  }

  async withdrawLeather(recipient) {
    console.log('🦊 Withdraw via Leather...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

    const provider = window.LeatherProvider || window.HiroWalletProvider;

    if (!provider) {
      throw new Error('Leather provider not found');
    }

    try {
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const argHex = this.encodePrincipal(recipient);

      console.log('📝 Contract:', contractId);
      console.log('👤 Recipient principal:', recipient);
      console.log('🔐 Hex-encoded principal:', argHex);

      const params = {
        contract: contractId,
        functionName: 'withdraw',
        functionArgs: [argHex],
        postConditionMode: 'allow',
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract (withdraw) with params:', params);

      const response = await provider.request('stx_callContract', params);
      console.log('✅ Withdraw transaction response:', response);

      if (response.error) {
        const errorMsg =
          response.error.message ||
          response.error.toString() ||
          'Withdraw transaction failed';
        throw new Error(errorMsg);
      }

      const txid = this.extractTxId(response);

      if (!txid) {
        throw new Error('No transaction ID returned from Leather (withdraw)');
      }

      return {
        success: true,
        txId: txid,
        walletType: 'leather',
      };
    } catch (error) {
      console.error('❌ Leather withdraw transaction failed:', error);

      let errorMessage = 'Withdraw transaction failed';

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

  async withdrawXverse(recipient) {
    console.log('⚡ Withdraw via Xverse...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

    if (!window.XverseProviders) {
      throw new Error('Xverse provider not found');
    }

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const argHex = this.encodePrincipal(recipient);

      console.log('📝 Contract:', contractId);
      console.log('👤 Recipient principal:', recipient);
      console.log('🔐 Hex-encoded principal:', argHex);

      const params = {
        contract: contractId,
        functionName: 'withdraw',
        functionArgs: [argHex],
        postConditionMode: 'allow',
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract (withdraw) with params:', params);

      const response = await stacksProvider.request('stx_callContract', params);
      console.log('✅ Withdraw transaction response:', response);

      if (response.error) {
        const errorMsg =
          response.error.message ||
          response.error.toString() ||
          'Withdraw transaction failed';
        throw new Error(errorMsg);
      }

      const txid = this.extractTxId(response);

      if (!txid) {
        throw new Error('No transaction ID returned from Xverse (withdraw)');
      }

      return {
        success: true,
        txId: txid,
        walletType: 'xverse',
      };
    } catch (error) {
      console.error('❌ Xverse withdraw transaction failed:', error);

      let errorMessage = 'Withdraw transaction failed';

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

export const walletManager = new WalletManager();
