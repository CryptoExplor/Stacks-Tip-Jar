// contract.js - Fixed transaction history fetching

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

  // FIXED: Transaction history fetching with proper error handling
  async fetchTransactionHistory(network = CONFIG.NETWORK.DEFAULT, limit = 10) {
    console.log('📜 Fetching transaction history...');
    
    try {
      // Get total transaction count first
      const totalResult = await this.callReadOnly('get-total-transactions', [], network);
      const total = this.extractValue(totalResult, 'uint');
      
      console.log('📊 Total transactions in contract:', total);
      
      if (total === 0) {
        console.log('ℹ️ No transactions yet');
        return [];
      }
      
      // Fetch the last N transactions
      const start = Math.max(1, total - limit + 1);
      const transactions = [];
      
      console.log(`🔍 Fetching transactions from ${start} to ${total}`);
      
      for (let i = total; i >= start && i > 0; i--) {
        try {
          console.log(`📡 Fetching transaction #${i}...`);
          
          const txResult = await this.callReadOnly(
            'get-transaction', 
            [this.encodeClarityUint(i)], 
            network
          );
          
          console.log(`📦 Raw TX #${i} response:`, txResult);
          
          const tx = this.extractTransaction(txResult, i);
          if (tx) {
            console.log(`✅ Extracted TX #${i}:`, tx);
            transactions.push(tx);
          } else {
            console.warn(`⚠️ Could not extract transaction #${i}`);
          }
        } catch (error) {
          console.warn(`❌ Failed to fetch transaction ${i}:`, error);
          // Continue to next transaction
        }
      }
      
      console.log('✅ Successfully fetched', transactions.length, 'transactions');
      this.cache.history = transactions;
      return transactions;
    } catch (error) {
      console.error('❌ Failed to fetch transaction history:', error);
      return [];
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

  encodePrincipal(address) {
    return `0x${Buffer.from(address).toString('hex')}`;
  }

  // FIXED: Better uint encoding
  encodeClarityUint(value) {
    // Ensure we have a proper uint representation
    const numValue = BigInt(value);
    const hex = numValue.toString(16).padStart(32, '0');
    // Clarity uint prefix: 0x01 (uint type indicator)
    return `0x01${hex}`;
  }

  // FIXED: Better transaction extraction
  extractTransaction(response, txId) {
    console.log('🔍 Extracting transaction from:', response);
    
    if (!response || !response.result) {
      console.warn('⚠️ No result in response');
      return null;
    }
    
    const result = response.result;
    
    // Handle optional type (none)
    if (result === 'none' || result.type === 'none') {
      console.log('ℹ️ Transaction returned none (optional empty)');
      return null;
    }
    
    // Handle optional type (some)
    let txData = result;
    if (result.type === 'some' && result.value) {
      txData = result.value;
      console.log('📦 Unwrapped optional value:', txData);
    }
    
    // Extract tuple fields
    if (typeof txData === 'object' && txData !== null) {
      try {
        const transaction = {
          txId: txId,
          tipper: this.extractTupleField(txData, 'tipper', 'principal'),
          amount: microToStx(this.extractTupleField(txData, 'amount', 'uint')),
          blockHeight: this.extractTupleField(txData, 'block-height', 'uint'),
          timestamp: this.extractTupleField(txData, 'timestamp', 'uint'),
          hasMessage: this.extractTupleField(txData, 'has-message', 'bool')
        };
        
        console.log('✅ Extracted transaction:', transaction);
        return transaction;
      } catch (error) {
        console.error('❌ Error extracting transaction fields:', error);
        return null;
      }
    }
    
    console.warn('⚠️ Unexpected transaction data format');
    return null;
  }

  // FIXED: Helper to extract tuple fields
  extractTupleField(tupleData, fieldName, expectedType) {
    // Try both formats: 'field-name' and 'fieldName'
    const value = tupleData[fieldName] || tupleData[fieldName.replace(/-/g, '')];
    
    if (value === undefined || value === null) {
      console.warn(`⚠️ Field ${fieldName} not found in tuple`);
      return expectedType === 'uint' ? 0 : expectedType === 'bool' ? false : null;
    }
    
    return this.extractValue({ result: value }, expectedType);
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
      if (typeof result === 'boolean') {
        return result;
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

  decodeClarityHex(hexString, expectedType) {
    console.log('🔍 Decoding Clarity hex:', hexString, 'Type:', expectedType);
    
    if (!hexString || !hexString.startsWith('0x')) {
      console.warn('⚠️ Invalid hex string');
      return null;
    }

    let hex = hexString.slice(2);
    console.log('📦 Hex without prefix:', hex);

    if (expectedType === 'uint') {
      if (hex.startsWith('01') && hex.length > 2) {
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
