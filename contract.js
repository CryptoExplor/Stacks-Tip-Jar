// contract.js - Smart contract interactions (FIXED v3 - Using repr format)

import { CONFIG, getNetworkEndpoint, microToStx } from './config.js';

export class ContractManager {
  constructor() {
    this.cache = {
      balance: null,
      totalTips: null,
      owner: null,
      lastUpdate: null,
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
      owner: null,
      lastUpdate: null,
    };
  }

  async fetchContractData(network = CONFIG.NETWORK.DEFAULT) {
    if (this.isCacheValid()) {
      console.log('💾 Using cached contract data');
      return this.cache;
    }

    const endpoint = getNetworkEndpoint(network);
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;

    console.log('🔍 Fetching fresh contract data from:', endpoint);
    console.log('📝 Contract ID:', contractId);

    try {
      const [balanceData, tipsData, ownerData] = await Promise.allSettled([
        this.callReadOnly('get-contract-balance', [], network),
        this.callReadOnly('get-total-tips', [], network),
        this.callReadOnly('get-owner', [], network),
      ]);

      console.log('📊 Raw API responses:');
      console.log('  Balance:', balanceData);
      console.log('  Tips:', tipsData);
      console.log('  Owner:', ownerData);

      const balance =
        balanceData.status === 'fulfilled'
          ? this.extractValue(balanceData.value, 'uint')
          : 0;

      const totalTips =
        tipsData.status === 'fulfilled'
          ? this.extractValue(tipsData.value, 'uint')
          : 0;

      const owner =
        ownerData.status === 'fulfilled'
          ? this.extractValue(ownerData.value, 'principal')
          : null;

      console.log('🔢 Extracted micro-STX values:');
      console.log('  Balance (micro):', balance);
      console.log('  Total tips (micro):', totalTips);
      console.log('  Owner:', owner);

      // Convert to STX for display
      const balanceSTX = microToStx(balance);
      const totalTipsSTX = microToStx(totalTips);

      console.log('💰 Converted STX values:');
      console.log('  Balance:', balanceSTX, 'STX');
      console.log('  Total tips:', totalTipsSTX, 'STX');

      this.cache = {
        balance: balanceSTX,
        totalTips: totalTipsSTX,
        owner,
        lastUpdate: Date.now(),
      };

      return this.cache;
    } catch (error) {
      console.error('❌ Failed to fetch contract data:', error);
      throw error;
    }
  }

  async callReadOnly(
    functionName,
    functionArgs = [],
    network = CONFIG.NETWORK.DEFAULT,
  ) {
    const endpoint = getNetworkEndpoint(network);
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
    const [contractAddress, contractName] = contractId.split('.');

    // Add tip parameter to get readable output (u123 instead of 0x...)
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
        throw new Error(
          `Contract call failed: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      console.log(`✅ ${functionName} full response:`, JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error(`❌ Error calling ${functionName}:`, error);
      throw error;
    }
  }

  extractValue(clarityResponse, expectedType = 'uint') {
    if (!clarityResponse) {
      console.warn('⚠️ Empty response received');
      return expectedType === 'uint' ? 0 : null;
    }

    console.log('🔍 Full response structure:', JSON.stringify(clarityResponse, null, 2));

    // Try to find the value in various places
    let result = null;
    
    // Check common response structures
    if (clarityResponse.okay === true && clarityResponse.result) {
      result = clarityResponse.result;
      console.log('📦 Found result in okay/result:', result);
    } else if (clarityResponse.result) {
      result = clarityResponse.result;
      console.log('📦 Found result:', result);
    } else {
      result = clarityResponse;
      console.log('📦 Using full response as result:', result);
    }

    if (expectedType === 'uint') {
      // Handle string values
      if (typeof result === 'string') {
        console.log('🔤 Result is string:', result);
        
        // Handle "u123" format (Clarity repr)
        if (result.startsWith('u')) {
          const numStr = result.slice(1);
          console.log('🔢 Extracting from u-format:', numStr);
          const parsed = parseInt(numStr, 10);
          
          if (!isNaN(parsed) && isFinite(parsed)) {
            console.log('✅ Successfully parsed uint:', parsed);
            return parsed;
          }
        }
        
        // Handle hex format
        if (result.startsWith('0x')) {
          console.log('🔢 Hex format detected, attempting parse');
          try {
            // Try simple hex parse first
            const hex = result.slice(2);
            const value = parseInt(hex, 16);
            
            if (!isNaN(value) && isFinite(value) && value < Number.MAX_SAFE_INTEGER) {
              console.log('✅ Parsed hex value:', value);
              return value;
            }
          } catch (e) {
            console.error('❌ Hex parse failed:', e);
          }
        }
        
        // Try direct number parse
        const directParse = parseInt(result, 10);
        if (!isNaN(directParse) && isFinite(directParse)) {
          console.log('✅ Direct string parse:', directParse);
          return directParse;
        }
      }
      
      // Handle number values
      if (typeof result === 'number') {
        console.log('🔢 Result is number:', result);
        if (isFinite(result) && !isNaN(result)) {
          console.log('✅ Using number directly:', result);
          return result;
        }
      }
      
      // Handle object with value field
      if (result && typeof result === 'object') {
        console.log('📦 Result is object, checking fields');
        
        if (result.value !== undefined) {
          console.log('Found value field:', result.value);
          // Recursively extract from value field
          return this.extractValue({ result: result.value }, expectedType);
        }
        
        if (result.data !== undefined) {
          console.log('Found data field:', result.data);
          return this.extractValue({ result: result.data }, expectedType);
        }
      }

      console.warn('⚠️ Could not parse uint from:', result);
      return 0;
    }

    if (expectedType === 'principal') {
      if (typeof result === 'string') {
        // Remove leading quote if present
        let principal = result;
        if (principal.startsWith("'")) {
          principal = principal.slice(1);
        }
        
        // Check if it looks like a valid Stacks address
        if (principal.startsWith('ST') || principal.startsWith('SP')) {
          console.log('✅ Extracted principal:', principal);
          return principal;
        }
        
        // Handle hex format - try to use cached value
        if (principal.startsWith('0x')) {
          console.log('⚠️ Principal in hex format');
          if (this.cache.owner && (this.cache.owner.startsWith('ST') || this.cache.owner.startsWith('SP'))) {
            console.log('✅ Using cached principal:', this.cache.owner);
            return this.cache.owner;
          }
        }
        
        return principal;
      }
      
      if (result && typeof result === 'object' && result.value) {
        return this.extractValue({ result: result.value }, expectedType);
      }
    }

    console.log('✅ Returning result as-is:', result);
    return result;
  }

  async getBalance(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    const data = await this.fetchContractData(network);
    return data.balance;
  }

  async getTotalTips(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    const data = await this.fetchContractData(network);
    return data.totalTips;
  }

  async getOwner(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    const data = await this.fetchContractData(network);
    return data.owner;
  }

  async getStats(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    return await this.fetchContractData(network);
  }

  async verifyTransaction(txId, network = CONFIG.NETWORK.DEFAULT) {
    const endpoint = getNetworkEndpoint(network);
    const url = `${endpoint}/extended/v1/tx/${txId}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { status: 'unknown', confirmed: false };
      }
      const data = await response.json();
      return {
        status: data.tx_status,
        confirmed: data.tx_status === 'success',
        blockHeight: data.block_height,
        fee: data.fee_rate,
      };
    } catch (error) {
      console.error('Failed to verify transaction:', error);
      return { status: 'error', confirmed: false };
    }
  }
}

export const contractManager = new ContractManager();
