// contract.js - FIXED principal encoding

import { CONFIG, getNetworkEndpoint, microToStx } from './config.js';
import { 
  principalCV, 
  cvToHex,
  uintCV
} from '@stacks/transactions';

export class ContractManager {
  constructor() {
    this.cache = {
      balance: null,
      totalTips: null,
      totalTippers: null,
      totalTransactions: null,
      owner: null,
      userStats: null,
      lastUpdate: null,
      history: null,
      userHistory: null
    };
    this.cacheTimeout = 5000;
    this.requestQueue = Promise.resolve(); // For rate limiting
  }

  isCacheValid() {
    if (!this.cache.lastUpdate) return false;
    return Date.now() - this.cache.lastUpdate < this.cacheTimeout;
  }

  clearCache() {
    console.log('🗑️ Clearing contract cache');
    this.cache = {
      balance: null,
      totalTips: null,
      totalTippers: null,
      totalTransactions: null,
      owner: null,
      userStats: null,
      lastUpdate: null,
      history: null,
      userHistory: null
    };
  }

  // FIXED: Use @stacks/transactions for proper encoding
  encodePrincipal(address) {
    try {
      const cv = principalCV(address);
      return cvToHex(cv);
    } catch (error) {
      console.error('❌ Failed to encode principal:', error);
      throw new Error(`Invalid principal address: ${address}`);
    }
  }

  encodeClarityUint(value) {
    try {
      const cv = uintCV(value);
      return cvToHex(cv);
    } catch (error) {
      console.error('❌ Failed to encode uint:', error);
      throw new Error(`Invalid uint value: ${value}`);
    }
  }

  // FIXED: Add rate limiting to prevent 429 errors
  async rateLimit() {
    // Wait 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async callReadOnly(functionName, functionArgs = [], network = CONFIG.NETWORK.DEFAULT) {
    // Queue requests to avoid rate limiting
    this.requestQueue = this.requestQueue.then(async () => {
      await this.rateLimit();
      
      const endpoint = getNetworkEndpoint(network);
      const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
      const [contractAddress, contractName] = contractId.split('.');

      const url = `${endpoint}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}?tip=latest`;

      const body = {
        sender: contractAddress,
        arguments: functionArgs,
      };

      console.log(`📡 Calling ${functionName} at ${url}`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ API error for ${functionName}:`, errorText);
          throw new Error(`Contract call failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ ${functionName} response:`, data);
        return data;
      } catch (error) {
        console.error(`❌ Error calling ${functionName}:`, error);
        throw error;
      }
    });

    return this.requestQueue;
  }

  async fetchContractData(network = CONFIG.NETWORK.DEFAULT, userAddress = null) {
    if (this.isCacheValid() && !userAddress) {
      console.log('💾 Using cached contract data');
      return this.cache;
    }

    const endpoint = getNetworkEndpoint(network);
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;

    console.log('🔍 Fetching fresh contract data from:', endpoint);
    console.log('📝 Contract ID:', contractId);

    try {
      // Fetch basic stats first (no arguments)
      const balance = await this.callReadOnly('get-contract-balance', [], network)
        .then(r => this.extractValue(r, 'uint'))
        .catch(() => 0);
      
      const totalTips = await this.callReadOnly('get-total-tips', [], network)
        .then(r => this.extractValue(r, 'uint'))
        .catch(() => 0);

      const totalTippers = await this.callReadOnly('get-total-tippers', [], network)
        .then(r => this.extractValue(r, 'uint'))
        .catch(() => 0);

      const totalTransactions = await this.callReadOnly('get-total-transactions', [], network)
        .then(r => this.extractValue(r, 'uint'))
        .catch(() => 0);

      const owner = await this.callReadOnly('get-owner', [], network)
        .then(r => this.extractValue(r, 'principal'))
        .catch(() => null);

      // Convert to STX for display
      const balanceSTX = microToStx(balance);
      const totalTipsSTX = microToStx(totalTips);

      console.log('💰 Converted STX values:');
      console.log('  Balance:', balanceSTX, 'STX');
      console.log('  Total tips:', totalTipsSTX, 'STX');
      console.log('  Total tippers:', totalTippers);
      console.log('  Total transactions:', totalTransactions);

      const data = {
        balance: balanceSTX,
        totalTips: totalTipsSTX,
        totalTippers,
        totalTransactions,
        owner,
        lastUpdate: Date.now(),
      };

      // FIXED: Only fetch user stats if address provided
      if (userAddress) {
        try {
          const userStatsResult = await this.callReadOnly(
            'get-tipper-stats', 
            [this.encodePrincipal(userAddress)], 
            network
          );
          
          const isPremiumResult = await this.callReadOnly(
            'is-premium-tipper', 
            [this.encodePrincipal(userAddress)], 
            network
          );

          if (userStatsResult) {
            const stats = this.extractUserStats(userStatsResult);
            const isPremium = isPremiumResult ? this.extractValue(isPremiumResult, 'bool') : false;
            
            data.userStats = {
              ...stats,
              isPremium
            };
            
            console.log('👤 User stats:', data.userStats);
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch user stats:', error.message);
          // Continue without user stats
        }
      }

      this.cache = data;
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch contract data:', error);
      throw error;
    }
  }

  // Rest of your methods stay the same...
  async fetchTransactionHistory(network = CONFIG.NETWORK.DEFAULT, limit = 10) {
    console.log('📜 Fetching transaction history...');
    
    try {
      const totalResult = await this.callReadOnly('get-total-transactions', [], network);
      const total = this.extractValue(totalResult, 'uint');
      
      if (total === 0) {
        return [];
      }
      
      const start = Math.max(1, total - limit + 1);
      const transactions = [];
      
      for (let i = total; i >= start && i > 0; i--) {
        try {
          const txResult = await this.callReadOnly(
            'get-transaction', 
            [this.encodeClarityUint(i)], 
            network
          );
          
          const tx = this.extractTransaction(txResult, i);
          if (tx) {
            transactions.push(tx);
          }
        } catch (error) {
          console.warn(`Failed to fetch transaction ${i}:`, error);
        }
      }
      
      console.log('✅ Fetched', transactions.length, 'transactions');
      this.cache.history = transactions;
      return transactions;
    } catch (error) {
      console.error('❌ Failed to fetch transaction history:', error);
      return [];
    }
  }

  decodeClarityHex(hexString, expectedType) {
    console.log('🔍 Decoding Clarity hex:', hexString, 'Type:', expectedType);
    
    if (!hexString || !hexString.startsWith('0x')) {
      console.warn('⚠️ Invalid hex string');
      return null;
    }

    let hex = hexString.slice(2);
    console.log('📦 Hex without prefix:', hex);

    if (expectedType === 'uint') {
      if (hex.startsWith('07') && hex.charAt(2) === '0' && hex.charAt(3) === '1') {
        hex = hex.slice(4);
        console.log('🔢 Value bytes:', hex);
        
        try {
          const value = BigInt('0x' + hex);
          const numValue = Number(value);
          console.log('✅ Decoded uint128:', numValue);
          return numValue;
        } catch (e) {
          console.error('❌ Failed to parse uint:', e);
          return 0;
        }
      }
      
      try {
        const value = parseInt(hex, 16);
        if (isFinite(value) && !isNaN(value)) {
          console.log('✅ Fallback parse:', value);
          return value;
        }
      } catch (e) {
        console.error('❌ Fallback parse failed:', e);
      }
      
      return 0;
    }

    if (expectedType === 'bool') {
      if (hex.startsWith('0703')) return true;
      if (hex.startsWith('0704')) return false;
      return false;
    }

    if (expectedType === 'principal') {
      if (hex.startsWith('0705') || hex.startsWith('0706')) {
        if (this.cache.owner && (this.cache.owner.startsWith('ST') || this.cache.owner.startsWith('SP'))) {
          console.log('✅ Using cached principal:', this.cache.owner);
          return this.cache.owner;
        }
        return '0x0705' + hex;
      }
      return null;
    }

    return null;
  }

  extractValue(clarityResponse, expectedType = 'uint') {
    if (!clarityResponse) {
      console.warn('⚠️ Empty response received');
      return expectedType === 'uint' ? 0 : expectedType === 'bool' ? false : null;
    }

    let result = clarityResponse.result ?? clarityResponse;
    
    if (result && typeof result === 'object' && result.result) {
      result = result.result;
    }

    console.log('📦 Extracted result:', result);

    if (expectedType === 'uint') {
      if (typeof result === 'string') {
        if (result.startsWith('0x')) {
          const decoded = this.decodeClarityHex(result, 'uint');
          if (decoded !== null) return decoded;
        }
        
        if (result.startsWith('u')) {
          const numStr = result.slice(1);
          const parsed = parseInt(numStr, 10);
          console.log('✅ Parsed u-format:', parsed);
          return parsed;
        }
        
        const num = parseInt(result, 10);
        if (isFinite(num) && !isNaN(num)) {
          console.log('✅ Direct parse:', num);
          return num;
        }
      }
      
      if (typeof result === 'number' && isFinite(result)) {
        console.log('✅ Number value:', result);
        return result;
      }

      console.warn('⚠️ Could not extract uint, returning 0');
      return 0;
    }

    if (expectedType === 'bool') {
      if (typeof result === 'string' && result.startsWith('0x')) {
        return this.decodeClarityHex(result, 'bool');
      }
      return Boolean(result);
    }

    if (expectedType === 'principal') {
      if (typeof result === 'string') {
        if (result.startsWith('0x')) {
          const decoded = this.decodeClarityHex(result, 'principal');
          if (decoded) return decoded;
        }
        
        let principal = result;
        if (principal.startsWith("'")) {
          principal = principal.slice(1);
        }
        
        if (principal.startsWith('ST') || principal.startsWith('SP')) {
          console.log('✅ String principal:', principal);
          return principal;
        }
        
        return principal;
      }
    }

    return result;
  }

  extractUserStats(response) {
    const result = response.result || response;
    
    if (typeof result === 'object' && result !== null) {
      return {
        totalTipped: microToStx(this.extractValue(result['total-tipped'] || result.totalTipped || 0, 'uint')),
        tipCount: this.extractValue(result['tip-count'] || result.tipCount || 0, 'uint'),
        lastTipBlock: this.extractValue(result['last-tip-block'] || result.lastTipBlock || 0, 'uint'),
        isPremium: this.extractValue(result['is-premium'] || result.isPremium || false, 'bool')
      };
    }
    
    return {
      totalTipped: 0,
      tipCount: 0,
      lastTipBlock: 0,
      isPremium: false
    };
  }

  extractTransaction(response, txId) {
    const result = response.result || response;
    
    if (!result || result === 'none' || result === '0x0709') {
      return null;
    }
    
    if (typeof result === 'object' && result !== null) {
      return {
        txId: txId,
        tipper: this.extractValue(result.tipper, 'principal'),
        amount: microToStx(this.extractValue(result.amount, 'uint')),
        blockHeight: this.extractValue(result['block-height'] || result.blockHeight, 'uint'),
        timestamp: this.extractValue(result.timestamp, 'uint'),
        hasMessage: this.extractValue(result['has-message'] || result.hasMessage, 'bool')
      };
    }
    
    return null;
  }

  async getBalance(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) this.clearCache();
    const data = await this.fetchContractData(network);
    return data.balance;
  }

  async getTotalTips(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) this.clearCache();
    const data = await this.fetchContractData(network);
    return data.totalTips;
  }

  async getStats(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false, userAddress = null) {
    if (forceRefresh) this.clearCache();
    return await this.fetchContractData(network, userAddress);
  }

  async getUserStats(userAddress, network = CONFIG.NETWORK.DEFAULT) {
    const data = await this.fetchContractData(network, userAddress);
    return data.userStats;
  }

  async getHistory(limit = 10, network = CONFIG.NETWORK.DEFAULT) {
    return await this.fetchTransactionHistory(network, limit);
  }
}

export const contractManager = new ContractManager();
