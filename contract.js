// contract.js - Enhanced with FIXED transaction history support

import { CONFIG, getNetworkEndpoint, microToStx } from './config.js';

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
      const fetchPromises = [
        this.callReadOnly('get-contract-balance', [], network),
        this.callReadOnly('get-total-tips', [], network),
        this.callReadOnly('get-total-tippers', [], network),
        this.callReadOnly('get-total-transactions', [], network),
        this.callReadOnly('get-owner', [], network),
      ];

      if (userAddress) {
        fetchPromises.push(
          this.callReadOnly('get-tipper-stats', [this.encodePrincipal(userAddress)], network),
          this.callReadOnly('is-premium-tipper', [this.encodePrincipal(userAddress)], network)
        );
      }

      const results = await Promise.allSettled(fetchPromises);

      console.log('📊 Raw API responses:', results);

      const balance = results[0].status === 'fulfilled' 
        ? this.extractValue(results[0].value, 'uint') 
        : 0;
      
      const totalTips = results[1].status === 'fulfilled'
        ? this.extractValue(results[1].value, 'uint')
        : 0;

      const totalTippers = results[2].status === 'fulfilled'
        ? this.extractValue(results[2].value, 'uint')
        : 0;

      const totalTransactions = results[3].status === 'fulfilled'
        ? this.extractValue(results[3].value, 'uint')
        : 0;

      const owner = results[4].status === 'fulfilled'
        ? this.extractValue(results[4].value, 'principal')
        : null;

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

      if (userAddress && results.length > 5) {
        const userStatsResult = results[5].status === 'fulfilled' ? results[5].value : null;
        const isPremiumResult = results[6].status === 'fulfilled' ? results[6].value : null;

        if (userStatsResult) {
          const stats = this.extractUserStats(userStatsResult);
          const isPremium = isPremiumResult ? this.extractValue(isPremiumResult, 'bool') : false;
          
          data.userStats = {
            ...stats,
            isPremium
          };
          
          console.log('👤 User stats:', data.userStats);
        }
      }

      this.cache = data;
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch contract data:', error);
      throw error;
    }
  }

  // FIXED: Proper Clarity uint encoding
  encodeClarityUint(value) {
    // Clarity uint format: 0x01 (type prefix) + 32-byte big-endian value
    const hex = value.toString(16).padStart(32, '0');
    return `0x01${hex}`;
  }

  // Encode principal for contract calls
  encodePrincipal(address) {
    // For read-only calls, we can use the simpler format
    return `0x0${Buffer.from(address, 'utf-8').toString('hex').padEnd(80, '0')}`;
  }

  // NEW: FIXED fetch transaction history
  async fetchTransactionHistory(network = CONFIG.NETWORK.DEFAULT, limit = 10) {
    console.log('📜 Fetching transaction history...');
    
    try {
      // Get total transaction count first
      const totalResult = await this.callReadOnly('get-total-transactions', [], network);
      const total = this.extractValue(totalResult, 'uint');
      
      console.log('📊 Total transactions:', total);
      
      if (total === 0) {
        console.log('✅ No transactions yet');
        return [];
      }
      
      // Fetch the last N transactions
      const start = Math.max(1, total - limit + 1);
      const transactions = [];
      
      console.log(`🔄 Fetching transactions ${start} to ${total}...`);
      
      // Fetch in parallel for better performance
      const fetchPromises = [];
      for (let i = total; i >= start && i > 0; i--) {
        fetchPromises.push(this.fetchSingleTransaction(i, network));
      }
      
      const results = await Promise.allSettled(fetchPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          transactions.push(result.value);
        } else {
          const txId = total - index;
          console.warn(`⚠️ Failed to fetch transaction ${txId}:`, result.reason);
        }
      });
      
      // Sort by txId descending (most recent first)
      transactions.sort((a, b) => b.txId - a.txId);
      
      console.log('✅ Fetched', transactions.length, 'transactions');
      this.cache.history = transactions;
      return transactions;
    } catch (error) {
      console.error('❌ Failed to fetch transaction history:', error);
      return [];
    }
  }

  // NEW: Fetch a single transaction with better error handling
  async fetchSingleTransaction(txId, network = CONFIG.NETWORK.DEFAULT) {
    try {
      console.log(`📄 Fetching transaction ${txId}...`);
      
      const result = await this.callReadOnly(
        'get-transaction', 
        [this.encodeClarityUint(txId)], 
        network
      );
      
      const tx = this.extractTransaction(result, txId);
      
      if (tx) {
        console.log(`✅ Transaction ${txId}:`, tx);
        return tx;
      } else {
        console.warn(`⚠️ Transaction ${txId} returned null/none`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Failed to fetch transaction ${txId}:`, error);
      return null;
    }
  }

  // NEW: Fetch user's transaction history
  async fetchUserHistory(userAddress, network = CONFIG.NETWORK.DEFAULT) {
    console.log('👤 Fetching user history for:', userAddress);
    
    try {
      const result = await this.callReadOnly(
        'get-user-transactions',
        [this.encodePrincipal(userAddress)],
        network
      );
      
      const userHistory = this.extractUserHistory(result);
      console.log('✅ User history:', userHistory);
      
      this.cache.userHistory = userHistory;
      return userHistory;
    } catch (error) {
      console.error('❌ Failed to fetch user history:', error);
      return null;
    }
  }

  async callReadOnly(functionName, functionArgs = [], network = CONFIG.NETWORK.DEFAULT) {
    const endpoint = getNetworkEndpoint(network);
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
    const [contractAddress, contractName] = contractId.split('.');

    const url = `${endpoint}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}?tip=latest`;

    const body = {
      sender: contractAddress,
      arguments: functionArgs,
    };

    console.log(`📡 Calling ${functionName} at ${url}`);
    console.log(`📦 Arguments:`, functionArgs);

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
      if (hex.startsWith('01')) {
        hex = hex.slice(2);
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
      if (hex.startsWith('03')) return true;
      if (hex.startsWith('04')) return false;
      return false;
    }

    if (expectedType === 'principal') {
      if (hex.startsWith('05') || hex.startsWith('06')) {
        if (this.cache.owner && (this.cache.owner.startsWith('ST') || this.cache.owner.startsWith('SP'))) {
          console.log('✅ Using cached principal:', this.cache.owner);
          return this.cache.owner;
        }
        return '0x05' + hex;
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

  // FIXED: Extract transaction from response with better handling
  extractTransaction(response, txId) {
    console.log(`🔍 Extracting transaction ${txId}:`, response);
    
    const result = response?.result || response;
    
    // Check for "none" response (transaction doesn't exist)
    if (!result || result === 'none' || 
        (typeof result === 'string' && result.includes('none'))) {
      console.log(`⚠️ Transaction ${txId} is none/doesn't exist`);
      return null;
    }
    
    // Handle tuple response
    if (typeof result === 'object' && result !== null) {
      try {
        const tx = {
          txId: txId,
          tipper: this.extractValue(result.tipper, 'principal'),
          amount: microToStx(this.extractValue(result.amount, 'uint')),
          blockHeight: this.extractValue(result['block-height'] || result.blockHeight, 'uint'),
          timestamp: this.extractValue(result.timestamp, 'uint'),
          hasMessage: this.extractValue(result['has-message'] || result.hasMessage, 'bool')
        };
        
        console.log(`✅ Extracted transaction ${txId}:`, tx);
        return tx;
      } catch (error) {
        console.error(`❌ Error extracting transaction ${txId}:`, error);
        return null;
      }
    }
    
    console.warn(`⚠️ Unexpected response format for transaction ${txId}`);
    return null;
  }

  extractUserHistory(response) {
    const result = response.result || response;
    
    if (typeof result === 'object' && result !== null) {
      return {
        user: this.extractValue(result.user, 'principal'),
        tipCount: this.extractValue(result['tip-count'] || result.tipCount, 'uint'),
        totalTipped: microToStx(this.extractValue(result['total-tipped'] || result.totalTipped, 'uint')),
        lastTipHeight: this.extractValue(result['last-tip-height'] || result.lastTipHeight, 'uint')
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

  // NEW: Get transaction history
  async getHistory(limit = 10, network = CONFIG.NETWORK.DEFAULT) {
    return await this.fetchTransactionHistory(network, limit);
  }

  // NEW: Get user history
  async getUserHistory(userAddress, network = CONFIG.NETWORK.DEFAULT) {
    return await this.fetchUserHistory(userAddress, network);
  }
}

export const contractManager = new ContractManager();
