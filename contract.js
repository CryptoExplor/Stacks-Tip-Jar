// contract.js - Smart contract interactions (FIXED VERSION)

import { CONFIG, getNetworkEndpoint, microToStx } from './config.js';

export class ContractManager {
  constructor() {
    this.cache = {
      balance: null,
      totalTips: null,
      owner: null,
      lastUpdate: null,
    };
    this.cacheTimeout = 5000; // Reduced to 5 seconds for more frequent updates
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
      // Try to extract uint from hex format (0x...)
      if (typeof result === 'string') {
        if (result.startsWith('0x')) {
          // Parse hex string
          try {
            // Remove 0x prefix and get the hex value
            const hexStr = result.slice(2);
            console.log('🔢 Parsing hex string:', hexStr);
            
            // The first byte is the type prefix (01 for uint)
            // The actual value starts after that
            if (hexStr.startsWith('01')) {
              const valueHex = hexStr.slice(2);
              const value = parseInt(valueHex, 16);
              console.log('✅ Parsed uint value:', value);
              return value;
            }
          } catch (e) {
            console.error('❌ Failed to parse hex uint:', e);
          }
        } else if (result.startsWith('u')) {
          // Handle "u123" format
          const numStr = result.slice(1);
          const parsed = parseInt(numStr, 10);
          console.log('✅ Parsed "u" format value:', parsed);
          return parsed;
        }
      }

      // Try direct number conversion
      const num = Number(result);
      if (Number.isFinite(num) && !Number.isNaN(num)) {
        console.log('✅ Direct conversion:', num);
        return num;
      }

      console.warn('⚠️ Could not parse uint, returning 0');
      return 0;
    }

    if (expectedType === 'principal') {
      if (typeof result === 'string') {
        // Handle hex format for principals
        if (result.startsWith('0x')) {
          try {
            // Principals in hex start with 05 or 06 (standard/contract)
            const hexStr = result.slice(2);
            if (hexStr.startsWith('05') || hexStr.startsWith('06')) {
              // For now, return the hex - in production you'd decode it properly
              console.log('⚠️ Principal in hex format, may need decoding');
              return result;
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
