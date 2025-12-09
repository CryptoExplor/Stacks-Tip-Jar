// contract.js - Smart contract interactions

import { CONFIG, getNetworkEndpoint, microToStx } from './config.js';

export class ContractManager {
  constructor() {
    this.cache = {
      balance: null,
      totalTips: null,
      owner: null,
      lastUpdate: null,
    };
    this.cacheTimeout = 10000; // 10 seconds
  }

  // Check if cache is valid
  isCacheValid() {
    if (!this.cache.lastUpdate) return false;
    return Date.now() - this.cache.lastUpdate < this.cacheTimeout;
  }

  // Clear cache
  clearCache() {
    this.cache = {
      balance: null,
      totalTips: null,
      owner: null,
      lastUpdate: null,
    };
  }

  // Fetch contract data via Hiro API
  async fetchContractData(network = CONFIG.NETWORK.DEFAULT) {
    if (this.isCacheValid()) {
      return this.cache;
    }

    const endpoint = getNetworkEndpoint(network);
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;

    try {
      // Fetch all data in parallel (output_type=repr for easy parsing)
      const [balanceData, tipsData, ownerData] = await Promise.allSettled([
        this.callReadOnly('get-contract-balance', [], network),
        this.callReadOnly('get-total-tips', [], network),
        this.callReadOnly('get-owner', [], network),
      ]);

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

      // Update cache (convert to STX for display)
      this.cache = {
        balance: microToStx(balance),
        totalTips: microToStx(totalTips),
        owner,
        lastUpdate: Date.now(),
      };

      return this.cache;
    } catch (error) {
      console.error('Failed to fetch contract data:', error);
      throw error;
    }
  }

  // Call read-only contract function via Hiro API
  async callReadOnly(
    functionName,
    functionArgs = [],
    network = CONFIG.NETWORK.DEFAULT,
  ) {
    const endpoint = getNetworkEndpoint(network);
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
    const [contractAddress, contractName] = contractId.split('.');

    // Use output_type=repr so result is like "u123" or "'ST3...."
    const url = `${endpoint}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}?output_type=repr`;

    const body = {
      sender: contractAddress,
      arguments: functionArgs, // hex-encoded args if needed; ours are []
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Contract call failed: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw error;
    }
  }

  // Extract value from Hiro call-read response
  // For this app we only need uints and principals.
  extractValue(clarityResponse, expectedType = 'uint') {
    if (!clarityResponse) return null;

    // Hiro format: { okay: true, result: "u123" } or { okay: true, result: "'ST3..."}
    const result = clarityResponse.result ?? clarityResponse;

    if (typeof result === 'string') {
      const repr = result.trim();

      if (expectedType === 'uint') {
        // "u123"
        if (repr.startsWith('u')) {
          return Number(repr.slice(1));
        }
        // fallback: try parse as number
        const num = Number(repr);
        return Number.isFinite(num) ? num : 0;
      }

      if (expectedType === 'principal') {
        // "'ST3ZQ...": strip leading single quote
        if (repr.startsWith("'")) {
          return repr.slice(1);
        }
        return repr;
      }

      return repr;
    }

    // Fallback for weird shapes: look for nested repr
    if (result && typeof result === 'object') {
      if (typeof result.repr === 'string') {
        return this.extractValue({ result: result.repr }, expectedType);
      }
    }

    return result;
  }

  // Get contract balance
  async getBalance(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    const data = await this.fetchContractData(network);
    return data.balance;
  }

  // Get total tips
  async getTotalTips(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    const data = await this.fetchContractData(network);
    return data.totalTips;
  }

  // Get contract owner
  async getOwner(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    const data = await this.fetchContractData(network);
    return data.owner;
  }

  // Get all contract stats
  async getStats(network = CONFIG.NETWORK.DEFAULT, forceRefresh = false) {
    if (forceRefresh) {
      this.clearCache();
    }
    return await this.fetchContractData(network);
  }

  // Verify transaction status
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

// Export singleton instance
export const contractManager = new ContractManager();
