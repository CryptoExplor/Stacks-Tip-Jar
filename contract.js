// contract.js - Smart contract interactions (FIXED v4 - Correct hex parsing)

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
      console.log(`✅ ${functionName} response:`, data);
      return data;
    } catch (error) {
      console.error(`❌ Error calling ${functionName}:`, error);
      throw error;
    }
  }

  // Decode Clarity hex value
  // Format: 0x07 (ok response) + 01 (uint type) + 16 bytes (uint128 value)
  decodeClarityHex(hexString, expectedType) {
    console.log('🔍 Decoding Clarity hex:', hexString, 'Type:', expectedType);
    
    if (!hexString || !hexString.startsWith('0x')) {
      console.warn('⚠️ Invalid hex string');
      return null;
    }

    // Remove 0x prefix
    let hex = hexString.slice(2);
    console.log('📦 Hex without prefix:', hex);

    if (expectedType === 'uint') {
      // Format: 07 (ok) + 01 (uint) + value bytes
      // Check for 0701 prefix
      if (hex.startsWith('07') && hex.charAt(2) === '0' && hex.charAt(3) === '1') {
        // Skip the 0701 prefix (4 chars)
        hex = hex.slice(4);
        console.log('🔢 Value bytes:', hex);
        
        // The remaining bytes are the uint128 value in big-endian format
        // Parse as BigInt first to handle large numbers
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
      
      // Fallback: try to parse the whole thing
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

    if (expectedType === 'principal') {
      // Format: 07 (ok) + 05 (standard principal) or 06 (contract principal) + address bytes
      if (hex.startsWith('0705') || hex.startsWith('0706')) {
        const type = hex.startsWith('0705') ? 'standard' : 'contract';
        console.log('🔑 Principal type:', type);
        
        // Skip 0705 or 0706 prefix
        hex = hex.slice(4);
        
        // For standard principal (0705):
        // Next byte is version (1a for testnet, 16 for mainnet)
        // Then 20 bytes (40 hex chars) for the hash
        
        if (type === 'standard' && hex.length >= 42) {
          const version = hex.slice(0, 2);
          const hash = hex.slice(2, 42);
          
          console.log('📋 Version:', version, 'Hash:', hash);
          
          // Convert to Stacks address format
          // This is a simplified version - proper implementation would use c32check encoding
          // For now, we'll return the hex and rely on cached values
          
          // If we have a cached owner address, use that
          if (this.cache.owner && (this.cache.owner.startsWith('ST') || this.cache.owner.startsWith('SP'))) {
            console.log('✅ Using cached principal:', this.cache.owner);
            return this.cache.owner;
          }
          
          // Return hex format as fallback
          return '0x0705' + hex;
        }
      }
      
      return null;
    }

    return null;
  }

  extractValue(clarityResponse, expectedType = 'uint') {
    if (!clarityResponse) {
      console.warn('⚠️ Empty response received');
      return expectedType === 'uint' ? 0 : null;
    }

    // Get the result field
    let result = clarityResponse.result ?? clarityResponse;
    
    if (result && typeof result === 'object' && result.result) {
      result = result.result;
    }

    console.log('📦 Extracted result:', result);

    if (expectedType === 'uint') {
      if (typeof result === 'string') {
        // Handle hex format (0x0701...)
        if (result.startsWith('0x')) {
          const decoded = this.decodeClarityHex(result, 'uint');
          if (decoded !== null && decoded !== 0) {
            return decoded;
          }
          
          // If decoded is 0, might be legitimately 0, so return it
          console.log('✅ Decoded value:', decoded);
          return decoded;
        }
        
        // Handle "u123" format
        if (result.startsWith('u')) {
          const numStr = result.slice(1);
          const parsed = parseInt(numStr, 10);
          console.log('✅ Parsed u-format:', parsed);
          return parsed;
        }
        
        // Try direct parse
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

    if (expectedType === 'principal') {
      if (typeof result === 'string') {
        // Handle hex format
        if (result.startsWith('0x')) {
          const decoded = this.decodeClarityHex(result, 'principal');
          if (decoded) {
            return decoded;
          }
        }
        
        // Handle string format
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
