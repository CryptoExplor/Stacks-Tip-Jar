// contract.js - Smart contract interactions (FIXED v2 - Scientific Notation Fix)

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

    const url = `${endpoint}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

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

  // Decode Clarity hex-encoded uint value
  decodeClarityUint(hexStr) {
    console.log('🔍 Decoding Clarity uint from hex:', hexStr);
    
    // Remove 0x prefix if present
    if (hexStr.startsWith('0x')) {
      hexStr = hexStr.slice(2);
    }

    // Clarity uint format: 01 (type) + length prefix + value bytes
    if (!hexStr.startsWith('01')) {
      console.warn('⚠️ Not a Clarity uint (missing 01 prefix)');
      return 0;
    }

    // Skip the 01 type byte
    hexStr = hexStr.slice(2);

    // For uint128, the format is more complex. Let's try a simpler approach:
    // Find the actual value bytes (usually the last 16 bytes for uint128)
    
    // If the hex string is very long, it likely has length encoding
    // Try to extract just the numeric value
    
    // Method 1: Try to parse the last bytes as the value
    // uint128 is 16 bytes = 32 hex chars
    if (hexStr.length > 32) {
      // Skip length encoding and get last 32 chars
      const valuePart = hexStr.slice(-32);
      console.log('🔢 Extracted value part (last 32 chars):', valuePart);
      
      try {
        // Parse as BigInt to handle large numbers
        const value = BigInt('0x' + valuePart);
        console.log('✅ Decoded uint (BigInt):', value.toString());
        
        // Convert to regular number (might lose precision for very large values)
        const numValue = Number(value);
        console.log('✅ Decoded uint (Number):', numValue);
        return numValue;
      } catch (e) {
        console.error('❌ Failed to parse value part:', e);
      }
    }

    // Method 2: Try direct hex to decimal conversion
    try {
      const value = BigInt('0x' + hexStr);
      const numValue = Number(value);
      console.log('✅ Direct conversion result:', numValue);
      return numValue;
    } catch (e) {
      console.error('❌ Direct conversion failed:', e);
    }

    console.warn('⚠️ All parsing methods failed, returning 0');
    return 0;
  }

  extractValue(clarityResponse, expectedType = 'uint') {
    if (!clarityResponse) {
      console.warn('⚠️ Empty response received');
      return expectedType === 'uint' ? 0 : null;
    }

    console.log('🔍 Extracting value from:', clarityResponse, 'Type:', expectedType);

    // Handle the nested structure: { okay: true, result: "0x..." }
    let result = clarityResponse.result ?? clarityResponse;

    // If result is still an object with a result field, unwrap it
    if (result && typeof result === 'object' && result.result) {
      result = result.result;
    }

    console.log('📦 Unwrapped result:', result);

    if (expectedType === 'uint') {
      if (typeof result === 'string') {
        // Handle hex format (0x...)
        if (result.startsWith('0x')) {
          const decoded = this.decodeClarityUint(result);
          console.log('✅ Final decoded value:', decoded);
          return decoded;
        } 
        // Handle "u123" format
        else if (result.startsWith('u')) {
          const numStr = result.slice(1);
          const parsed = parseInt(numStr, 10);
          console.log('✅ Parsed "u" format value:', parsed);
          return parsed;
        }
      }

      // Try direct number conversion
      const num = Number(result);
      if (Number.isFinite(num) && !Number.isNaN(num) && num < Number.MAX_SAFE_INTEGER) {
        console.log('✅ Direct conversion (safe):', num);
        return num;
      }

      console.warn('⚠️ Could not parse uint safely, returning 0');
      return 0;
    }

    if (expectedType === 'principal') {
      if (typeof result === 'string') {
        // Handle hex format for principals
        if (result.startsWith('0x')) {
          try {
            // Principals in hex: 05 (standard) or 06 (contract) + 20 bytes hash
            const hexStr = result.slice(2);
            
            if (hexStr.startsWith('05') || hexStr.startsWith('06')) {
              // Skip type byte and version byte, then decode the hash
              // This is complex - for now just return what we have
              console.log('⚠️ Principal in hex format - using cached value');
              
              // If we have it cached from a previous call, use that
              if (this.cache.owner && this.cache.owner.startsWith('ST')) {
                return this.cache.owner;
              }
            }
          } catch (e) {
            console.error('❌ Failed to parse hex principal:', e);
          }
        }
        
        // Remove leading quote if present
        if (result.startsWith("'")) {
          result = result.slice(1);
        }
        
        console.log('✅ Extracted principal:', result);
        return result;
      }
    }

    console.log('✅ Returning raw result:', result);
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
