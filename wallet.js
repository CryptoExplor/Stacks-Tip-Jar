// wallet.js - Complete wallet management with AppKit support
import { CONFIG } from './config.js';
import { uintCV, cvToHex, standardPrincipalCV } from '@stacks/transactions';

export class WalletManager {
  constructor() {
    this.address = null;
    this.walletType = null;
    this.listeners = [];
    this.isReady = false;
    this.lastFaucetClaim = null;
    this.autoReconnected = false;
    this.appkit = null;
    
    // Initialize AppKit
    this.initAppKit();
    
    // Load saved wallet state
    this.loadWalletState();
  }

  // Initialize Reown AppKit
  async initAppKit() {
    if (typeof window === 'undefined') return;
    
    try {
      const { createAppKit } = await import('@reown/appkit');
      const { BitcoinAdapter } = await import('@reown/appkit-adapter-bitcoin');
      
      const BitcoinAdapter = new BitcoinAdapter({
        network: CONFIG.NETWORK.DEFAULT
      });
      
      this.appkit = createAppKit({
        adapters: [BitcoinAdapter],
        networks: [{
          id: CONFIG.NETWORK.DEFAULT === 'mainnet' ? 'stacks' : 'stacks-testnet',
          name: CONFIG.NETWORK.DEFAULT === 'mainnet' ? 'Stacks' : 'Stacks Testnet',
          nativeCurrency: { name: 'STX', symbol: 'STX', decimals: 6 },
          rpcUrls: {
            default: { http: [CONFIG.NETWORK.ENDPOINTS[CONFIG.NETWORK.DEFAULT]] }
          }
        }],
        metadata: {
          name: CONFIG.APP.NAME,
          description: CONFIG.APP.DESCRIPTION,
          url: CONFIG.APP.URL,
          icons: [CONFIG.APP.ICON]
        },
        projectId: '75cff2cd446ad1ae6c9f22c5c9bbcd6d',
        features: {
          analytics: true,
          email: false,
          socials: []
        }
      });

      // Subscribe to AppKit events
      this.appkit.subscribeEvents((event) => {
        console.log('🌐 AppKit event:', event);
        if (event.data?.address) {
          this.address = event.data.address;
          this.walletType = 'appkit';
          this.autoReconnected = false;
          this.saveWalletState();
          this.notify();
        }
      });

      console.log('✅ AppKit initialized');
    } catch (error) {
      console.error('❌ AppKit initialization failed:', error);
    }
  }

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

  loadWalletState() {
    try {
      const saved = localStorage.getItem('stacks_wallet_state');
      if (saved) {
        const state = JSON.parse(saved);
        const hoursSince = (Date.now() - state.timestamp) / (1000 * 60 * 60);
        
        if (hoursSince < 24) {
          this.address = state.address;
          this.walletType = state.walletType;
          this.autoReconnected = true;
          console.log('✅ Restored wallet state:', state);
          
          setTimeout(() => {
            console.log('🔔 Notifying listeners of auto-reconnect');
            this.notify();
          }, 100);
          
          return true;
        } else {
          console.log('⚠️ Wallet state expired, clearing...');
          localStorage.removeItem('stacks_wallet_state');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load wallet state:', error);
      localStorage.removeItem('stacks_wallet_state');
    }
    return false;
  }

  clearWalletState() {
    localStorage.removeItem('stacks_wallet_state');
    console.log('🗑️ Cleared wallet state');
  }

  wasAutoReconnected() {
    return this.autoReconnected;
  }

  async waitForWallets() {
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const availability = this.checkAvailability();
      if (availability.leather || availability.xverse || availability.appkit) {
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

  subscribe(callback) {
    this.listeners.push(callback);
    
    if (this.address) {
      console.log('🔔 Immediate callback for existing connection');
      callback({
        address: this.address,
        walletType: this.walletType,
        connected: true,
      });
    }
    
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    console.log('🔔 Notifying', this.listeners.length, 'listeners');
    const state = {
      address: this.address,
      walletType: this.walletType,
      connected: !!this.address,
    };
    console.log('📤 State being sent:', state);
    
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (error) {
        console.error('❌ Error in listener callback:', error);
      }
    });
  }

  checkAvailability() {
    if (typeof window === 'undefined') {
      return { leather: false, xverse: false, appkit: false };
    }

    return {
      leather: typeof window.LeatherProvider !== 'undefined' || 
               typeof window.HiroWalletProvider !== 'undefined',
      xverse: typeof window.XverseProviders !== 'undefined',
      appkit: this.appkit !== null
    };
  }

  encodeClarityUint(microAmount) {
    const cv = uintCV(microAmount);
    return cvToHex(cv);
  }

  encodePrincipal(address) {
    const cv = standardPrincipalCV(address);
    return cvToHex(cv);
  }

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

  async connectLeather() {
    console.log('🔌 Attempting Leather connection...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

    const provider = window.LeatherProvider || window.HiroWalletProvider;

    if (!provider) {
      throw new Error('Leather wallet not installed. Install from leather.io');
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
      this.autoReconnected = false;
      console.log('✅ Connected:', this.address);
      
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

  async connectXverse() {
    console.log('🔌 Attempting Xverse connection...');

    if (typeof window === 'undefined') {
      throw new Error('Wallets are only available in the browser');
    }

    if (typeof window.XverseProviders === 'undefined') {
      throw new Error('Xverse wallet not installed. Install from xverse.app');
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
      this.autoReconnected = false;
      console.log('✅ Connected:', this.address);
      
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

  async connectAppKit() {
    console.log('🌐 Attempting AppKit connection...');

    if (!this.appkit) {
      throw new Error('AppKit not initialized');
    }

    try {
      await this.appkit.open();
      
      // Wait for connection with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 30000); // 30 second timeout

        const checkConnection = setInterval(() => {
          if (this.address && this.walletType === 'appkit') {
            clearTimeout(timeout);
            clearInterval(checkConnection);
            resolve({
              success: true,
              address: this.address,
              walletType: this.walletType,
            });
          }
        }, 500);
      });
    } catch (error) {
      console.error('❌ AppKit connection error:', error);
      throw error;
    }
  }

  disconnect() {
    console.log('🔌 Disconnecting wallet...');
    
    if (this.walletType === 'appkit' && this.appkit) {
      this.appkit.disconnect();
    }
    
    this.address = null;
    this.walletType = null;
    this.autoReconnected = false;
    this.clearWalletState();
    this.notify();
  }

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
          throw new Error('Faucet rate limit reached. Try again later.');
        }
        
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.message || JSON.stringify(errorData);
        } catch {
          errorText = await response.text();
        }
        
        if (response.status === 500) {
          throw new Error('Faucet service temporarily unavailable.');
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
      } else if (this.walletType === 'appkit') {
        return await this.sendTipAppKit(microAmount);
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

      const params = {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [argHex],
        postConditionMode: 'allow',
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract:', params);

      const response = await provider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      const txid = this.extractTxId(response);

      if (!txid) {
        throw new Error('No transaction ID returned');
      }

      return {
        success: true,
        txId: txid,
        walletType: 'leather',
      };
    } catch (error) {
      console.error('❌ Leather transaction failed:', error);
      throw new Error(error.message || 'Transaction failed');
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

      const params = {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [argHex],
        postConditionMode: 'allow',
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract:', params);

      const response = await stacksProvider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      const txid = this.extractTxId(response);

      if (!txid) {
        throw new Error('No transaction ID returned');
      }

      return {
        success: true,
        txId: txid,
        walletType: 'xverse',
      };
    } catch (error) {
      console.error('❌ Xverse transaction failed:', error);
      throw new Error(error.message || 'Transaction failed');
    }
  }

  async sendTipAppKit(microAmount) {
    console.log('🌐 Sending via AppKit...');

    if (!this.appkit) {
      throw new Error('AppKit not initialized');
    }

    try {
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const argHex = this.encodeClarityUint(microAmount);

      const params = {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [argHex],
        postConditionMode: 'allow',
        network: CONFIG.NETWORK.DEFAULT,
      };

      const response = await this.appkit.writeContract(params);
      console.log('✅ AppKit response:', response);

      const txid = this.extractTxId(response);

      if (!txid) {
        throw new Error('No transaction ID returned');
      }

      return {
        success: true,
        txId: txid,
        walletType: 'appkit',
      };
    } catch (error) {
      console.error('❌ AppKit transaction failed:', error);
      throw new Error(error.message || 'Transaction failed');
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
      } else if (this.walletType === 'appkit') {
        return await this.withdrawAppKit(this.address);
      } else {
        throw new Error('Unknown wallet type: ' + this.walletType);
      }
    } catch (error) {
      console.error('❌ Withdraw error:', error);
      throw error;
    }
  }

  async withdrawLeather(recipient) {
    const provider = window.LeatherProvider || window.HiroWalletProvider;
    if (!provider) throw new Error('Leather provider not found');

    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
    const argHex = this.encodePrincipal(recipient);

    const params = {
      contract: contractId,
      functionName: 'withdraw',
      functionArgs: [argHex],
      postConditionMode: 'allow',
      network: CONFIG.NETWORK.DEFAULT,
    };

    const response = await provider.request('stx_callContract', params);
    if (response.error) throw new Error(response.error.message);

    const txid = this.extractTxId(response);
    if (!txid) throw new Error('No transaction ID returned');

    return { success: true, txId: txid, walletType: 'leather' };
  }

  async withdrawXverse(recipient) {
    if (!window.XverseProviders) throw new Error('Xverse provider not found');

    const stacksProvider = window.XverseProviders.StacksProvider;
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
    const argHex = this.encodePrincipal(recipient);

    const params = {
      contract: contractId,
      functionName: 'withdraw',
      functionArgs: [argHex],
      postConditionMode: 'allow',
      network: CONFIG.NETWORK.DEFAULT,
    };

    const response = await stacksProvider.request('stx_callContract', params);
    if (response.error) throw new Error(response.error.message);

    const txid = this.extractTxId(response);
    if (!txid) throw new Error('No transaction ID returned');

    return { success: true, txId: txid, walletType: 'xverse' };
  }

  async withdrawAppKit(recipient) {
    if (!this.appkit) throw new Error('AppKit not initialized');

    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
    const argHex = this.encodePrincipal(recipient);

    const params = {
      contract: contractId,
      functionName: 'withdraw',
      functionArgs: [argHex],
      postConditionMode: 'allow',
      network: CONFIG.NETWORK.DEFAULT,
    };

    const response = await this.appkit.writeContract(params);
    const txid = this.extractTxId(response);
    if (!txid) throw new Error('No transaction ID returned');

    return { success: true, txId: txid, walletType: 'appkit' };
  }
}

export const walletManager = new WalletManager();
