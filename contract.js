// contract.js - Smart contract interactions
import { CONFIG, getNetworkEndpoint, microToStx } from './config.js';

export class ContractManager {
  constructor() {
    this.cache = {
      balance: null,
      totalTips: null,
      owner: null,
      lastUpdate: null
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
      lastUpdate: null
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
      // Fetch all data in parallel
      const [balanceData, tipsData, ownerData] = await Promise.allSettled([
        this.callReadOnly('get-contract-balance', [], network),
        this.callReadOnly('get-total-tips', [], network),
        this.callReadOnly('get-owner', [], network)
      ]);

      // Process results
      const balance = balanceData.status === 'fulfilled' 
        ? this.extractValue(balanceData.value) 
        : 0;
      
      const totalTips = tipsData.status === 'fulfilled'
        ? this.extractValue(tipsData.value)
        : 0;
      
      const owner = ownerData.status === 'fulfilled'
        ? this.extractValue(ownerData.value)
        : null;

      // Update cache
      this.cache = {
        balance: microToStx(balance),
        totalTips: microToStx(totalTips),
        owner,
        lastUpdate: Date.now()
      };

      return this.cache;
    } catch (error) {
      console.error('Failed to fetch contract data:', error);
      throw error;
    }
  }

  // Call read-only contract function via Hiro API
  async callReadOnly(functionName, functionArgs = [], network = CONFIG.NETWORK.DEFAULT) {
    const endpoint = getNetworkEndpoint(network);
    const contractId = `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
    const [contractAddress, contractName] = contractId.split('.');

    const url = `${endpoint}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

    const body = {
      sender: contractAddress,
      arguments: functionArgs
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Contract call failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw error;
    }
  }

  // Extract value from Clarity response
  extractValue(clarityResponse) {
    if (!clarityResponse) return null;

    // Handle different response formats
    if (clarityResponse.okay !== undefined) {
      clarityResponse = clarityResponse.okay;
    }

    if (typeof clarityResponse === 'object') {
      // Handle nested structures
      if (clarityResponse.value !== undefined) {
        return this.extractValue(clarityResponse.value);
      }
      
      if (clarityResponse.uint !== undefined) {
        return clarityResponse.uint;
      }
      
      if (clarityResponse.int !== undefined) {
        return clarityResponse.int;
      }

      if (clarityResponse.principal !== undefined) {
        return clarityResponse.principal;
      }

      // Handle hex representation
      if (clarityResponse.repr !== undefined) {
        return clarityResponse.repr;
      }
    }

    return clarityResponse;
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
        fee: data.fee_rate
      };
    } catch (error) {
      console.error('Failed to verify transaction:', error);
      return { status: 'error', confirmed: false };
    }
  }
}

// Export singleton instance
export const contractManager = new ContractManager();
