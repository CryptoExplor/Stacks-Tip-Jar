// wallet.js - Wallet management (FIXED)
import { CONFIG, validateNetwork, storage } from './config.js';
import { 
  uintCV, 
  cvToHex, 
  standardPrincipalCV, 
  stringUtf8CV,
  PostConditionMode,
  makeStandardSTXPostCondition,
  FungibleConditionCode
} from '@stacks/transactions';

export class WalletManager {
  constructor() {
    this.address = null;
    this.walletType = null;
    this.listeners = [];
    this.isReady = false;
    this.lastFaucetClaim = null;
    this.autoReconnected = false;
    this.pendingTxTimeout = null;
    
    // Load saved wallet state and faucet cooldown
    this.loadWalletState();
    this.loadFaucetCooldown();
  }

  saveWalletState() {
    if (this.address && this.walletType) {
      const state = {
        address: this.address,
        walletType: this.walletType,
        timestamp: Date.now()
      };
      storage.set('stacks_wallet_state', state);
      console.log('💾 Saved wallet state');
    }
  }

  loadWalletState() {
    const saved = storage.get('stacks_wallet_state');
    if (saved) {
      const hoursSince = (Date.now() - saved.timestamp) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        this.address = saved.address;
        this.walletType = saved.walletType;
        this.autoReconnected = true;
        console.log('✅ Restored wallet state:', saved);
        
        setTimeout(() => {
          console.log('🔔 Notifying listeners of auto-reconnect');
          this.notify();
        }, 100);
        
        return true;
      } else {
        console.log('⚠️ Wallet state expired, clearing...');
        storage.remove('stacks_wallet_state');
      }
    }
    return false;
  }

  clearWalletState() {
    storage.remove('stacks_wallet_state');
    console.log('🗑️ Cleared wallet state');
  }

  // FIXED: Persist faucet cooldown
  saveFaucetCooldown() {
    if (this.lastFaucetClaim) {
      storage.set('faucet_last_claim', this.lastFaucetClaim);
    }
  }

  loadFaucetCooldown() {
    const lastClaim = storage.get('faucet_last_claim');
    if (lastClaim) {
      const timeSince = Date.now() - lastClaim;
      if (timeSince < CONFIG.FAUCET.COOLDOWN) {
        this.lastFaucetClaim = lastClaim;
        console.log('✅ Restored faucet cooldown');
      } else {
        storage.remove('faucet_last_claim');
      }
    }
  }

  wasAutoReconnected() {
    return this.autoReconnected;
  }

  async waitForWallets() {
    let attempts = 0;
    const maxAttempts = 30; // Increased from 20

    while (attempts < maxAttempts) {
      const availability = this.checkAvailability();
      if (availability.leather || availability.xverse) {
        this.isReady = true;
        console.log('✅ Wallets detected:', availability);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100ms
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
      return { leather: false, xverse: false };
    }

    return {
      leather: typeof window.LeatherProvider !== 'undefined' || 
               typeof window.HiroWalletProvider !== 'undefined',
      xverse: typeof window.XverseProviders !== 'undefined'
    };
  }

  // FIXED: Use @stacks/transactions instead of raw Buffer
  encodeClarityUint(microAmount) {
    const cv = uintCV(microAmount);
    return cvToHex(cv);
  }

  encodePrincipal(address) {
    const cv = standardPrincipalCV(address);
    return cvToHex(cv);
  }

  encodeClarityString(str) {
    const cv = stringUtf8CV(str);
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
      
      // FIXED: Validate network matches
      validateNetwork(this.address, CONFIG.NETWORK.DEFAULT);
      
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
      
      // FIXED: Validate network matches
      validateNetwork(this.address, CONFIG.NETWORK.DEFAULT);
      
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

  disconnect() {
    console.log('🔌 Disconnecting wallet...');
    
    this.address = null;
    this.walletType = null;
    this.autoReconnected = false;
    
    if (this.pendingTxTimeout) {
      clearTimeout(this.pendingTxTimeout);
      this.pendingTxTimeout = null;
    }
    
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
      this.saveFaucetCooldown(); // FIXED: Persist cooldown
      
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

  // FIXED: Added transaction timeout
  async withTimeout(promise, timeoutMs = CONFIG.TX.TIMEOUT) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        this.pendingTxTimeout = setTimeout(() => {
          reject(new Error('Transaction timeout - wallet did not respond'));
        }, timeoutMs);
      })
    ]);
  }

  async sendTip(amount) {
    console.log('💸 Attempting to send tip:', amount, 'STX');

    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid tip amount');
    }

    if (amount > CONFIG.UI.MAX_TIP) {
      throw new Error(`Tip amount exceeds maximum (${CONFIG.UI.MAX_TIP} STX)`);
    }

    const microAmount = Math.floor(amount * 1_000_000);
    console.log('💰 Micro amount:', microAmount);

    try {
      const result = this.walletType === 'leather'
        ? await this.withTimeout(this.sendTipLeather(microAmount))
        : await this.withTimeout(this.sendTipXverse(microAmount));
      
      if (this.pendingTxTimeout) {
        clearTimeout(this.pendingTxTimeout);
        this.pendingTxTimeout = null;
      }
      
      return result;
    } catch (error) {
      if (this.pendingTxTimeout) {
        clearTimeout(this.pendingTxTimeout);
        this.pendingTxTimeout = null;
      }
      console.error('❌ Send tip error:', error);
      throw error;
    }
  }

  async sendTipWithMessage(amount, message) {
    console.log('💬 Attempting to send tip with message:', amount, 'STX');
    console.log('📝 Message:', message);

    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid tip amount');
    }

    if (!message || message.length === 0) {
      return await this.sendTip(amount);
    }

    // FIXED: Correct length check
    if (message.length > CONFIG.UI.MAX_MESSAGE_LENGTH) {
      throw new Error(`Message too long (max ${CONFIG.UI.MAX_MESSAGE_LENGTH} characters)`);
    }

    const microAmount = Math.floor(amount * 1_000_000);
    console.log('💰 Micro amount:', microAmount);

    try {
      const result = this.walletType === 'leather'
        ? await this.withTimeout(this.sendTipWithMessageLeather(microAmount, message))
        : await this.withTimeout(this.sendTipWithMessageXverse(microAmount, message));
      
      if (this.pendingTxTimeout) {
        clearTimeout(this.pendingTxTimeout);
        this.pendingTxTimeout = null;
      }
      
      return result;
    } catch (error) {
      if (this.pendingTxTimeout) {
        clearTimeout(this.pendingTxTimeout);
        this.pendingTxTimeout = null;
      }
      console.error('❌ Send tip with message error:', error);
      throw error;
    }
  }

  async sendTipLeather(microAmount) {
    console.log('🦊 Sending via Leather...');

    const provider = window.LeatherProvider || window.HiroWalletProvider;
    if (!provider) throw new Error('Leather provider not found');

    try {
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const argHex = this.encodeClarityUint(microAmount);

      const params = {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [argHex],
        postConditionMode: PostConditionMode.Deny,
        postConditions: [
          makeStandardSTXPostCondition(
            this.address,
            FungibleConditionCode.Equal,
            microAmount
          )
        ],
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract:', params);
      const response = await provider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      const txid = this.extractTxId(response);
      if (!txid) throw new Error('No transaction ID returned');

      return { success: true, txId: txid, walletType: 'leather' };
    } catch (error) {
      console.error('❌ Leather transaction failed:', error);
      throw error;
    }
  }

  async sendTipWithMessageLeather(microAmount, message) {
    console.log('🦊 Sending with message via Leather...');

    const provider = window.LeatherProvider || window.HiroWalletProvider;
    if (!provider) throw new Error('Leather provider not found');

    try {
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const amountHex = this.encodeClarityUint(microAmount);
      const messageHex = this.encodeClarityString(message);

      const params = {
        contract: contractId,
        functionName: 'send-tip-with-message',
        functionArgs: [amountHex, messageHex],
        postConditionMode: PostConditionMode.Deny,
        postConditions: [
          makeStandardSTXPostCondition(
            this.address,
            FungibleConditionCode.Equal,
            microAmount
          )
        ],
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling send-tip-with-message:', params);
      const response = await provider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      const txid = this.extractTxId(response);
      if (!txid) throw new Error('No transaction ID returned');

      return { success: true, txId: txid, walletType: 'leather', hasMessage: true };
    } catch (error) {
      console.error('❌ Leather transaction failed:', error);
      throw error;
    }
  }

  async sendTipXverse(microAmount) {
    console.log('⚡ Sending via Xverse...');

    if (!window.XverseProviders) throw new Error('Xverse provider not found');

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const argHex = this.encodeClarityUint(microAmount);

      const params = {
        contract: contractId,
        functionName: 'send-tip',
        functionArgs: [argHex],
        postConditionMode: PostConditionMode.Deny,
        postConditions: [
          makeStandardSTXPostCondition(
            this.address,
            FungibleConditionCode.Equal,
            microAmount
          )
        ],
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling stx_callContract:', params);
      const response = await stacksProvider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      const txid = this.extractTxId(response);
      if (!txid) throw new Error('No transaction ID returned');

      return { success: true, txId: txid, walletType: 'xverse' };
    } catch (error) {
      console.error('❌ Xverse transaction failed:', error);
      throw error;
    }
  }

  async sendTipWithMessageXverse(microAmount, message) {
    console.log('⚡ Sending with message via Xverse...');

    if (!window.XverseProviders) throw new Error('Xverse provider not found');

    try {
      const stacksProvider = window.XverseProviders.StacksProvider;
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const amountHex = this.encodeClarityUint(microAmount);
      const messageHex = this.encodeClarityString(message);

      const params = {
        contract: contractId,
        functionName: 'send-tip-with-message',
        functionArgs: [amountHex, messageHex],
        postConditionMode: PostConditionMode.Deny,
        postConditions: [
          makeStandardSTXPostCondition(
            this.address,
            FungibleConditionCode.Equal,
            microAmount
          )
        ],
        network: CONFIG.NETWORK.DEFAULT,
      };

      console.log('📤 Calling send-tip-with-message:', params);
      const response = await stacksProvider.request('stx_callContract', params);
      console.log('✅ Transaction response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Transaction failed');
      }

      const txid = this.extractTxId(response);
      if (!txid) throw new Error('No transaction ID returned');

      return { success: true, txId: txid, walletType: 'xverse', hasMessage: true };
    } catch (error) {
      console.error('❌ Xverse transaction failed:', error);
      throw error;
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
      const result = this.walletType === 'leather'
        ? await this.withTimeout(this.withdrawLeather(this.address))
        : await this.withTimeout(this.withdrawXverse(this.address));
      
      if (this.pendingTxTimeout) {
        clearTimeout(this.pendingTxTimeout);
        this.pendingTxTimeout = null;
      }
      
      return result;
    } catch (error) {
      if (this.pendingTxTimeout) {
        clearTimeout(this.pendingTxTimeout);
        this.pendingTxTimeout = null;
      }
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
      postConditionMode: PostConditionMode.Allow, // Owner withdrawal
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
      postConditionMode: PostConditionMode.Allow, // Owner withdrawal
      network: CONFIG.NETWORK.DEFAULT,
    };

    const response = await stacksProvider.request('stx_callContract', params);
    if (response.error) throw new Error(response.error.message);

    const txid = this.extractTxId(response);
    if (!txid) throw new Error('No transaction ID returned');

    return { success: true, txId: txid, walletType: 'xverse' };
  }
}

export const walletManager = new WalletManager();
