// config.js - Configuration with alternative API endpoints
export const CONFIG = {
  CONTRACT: {
    ADDRESS: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG',
    NAME: 'tip-jar-v4',
    OWNER: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG'
  },

  NETWORK: {
    DEFAULT: 'testnet',
    ENDPOINTS: {
      // Try these alternative endpoints - they might have better CORS
      mainnet: 'https://api.hiro.so',
      testnet: 'https://api.testnet.hiro.so',
      // Alternative: Stack's official API
      testnetAlt: 'https://stacks-node-api.testnet.stacks.co',
      // Alternative: Blockstack PBC API
      testnetAlt2: 'https://stacks-blockchain-api-testnet.hiro.so'
    }
  },

  FAUCET: {
    ENABLED: true,
    ENDPOINT: 'https://api.testnet.hiro.so/extended/v1/faucets/stx',
    COOLDOWN: 300000,
    AMOUNT: 500
  },

  APP: {
    NAME: 'Stacks Tip Jar - Clarity 4 Enhanced',
    DESCRIPTION: 'Send STX tips with memos on Bitcoin L2 - Built with Clarity 4',
    ICON: '/icon.png',
    URL: typeof window !== 'undefined' ? window.location.origin : 'https://stacks-chi.vercel.app'
  },

  TX: {
    POLLING_INTERVAL: 5000,
    CONFIRMATION_BLOCKS: 1,
    TIMEOUT: 120000
  },

  UI: {
    QUICK_AMOUNTS: [0.1, 0.5, 1, 5],
    MIN_TIP: 0.000001,
    MAX_TIP: 1000000,
    DECIMALS: 6,
    MAX_MESSAGE_LENGTH: 280,
    SHOW_MEMO_SUPPORT: true,
    SHOW_MESSAGE_SUPPORT: true,
    SHOW_CONSENSUS_HASH: true
  }
};

export function getNetworkEndpoint(network = CONFIG.NETWORK.DEFAULT) {
  // Try alternative endpoints if primary fails
  return CONFIG.NETWORK.ENDPOINTS[network] || CONFIG.NETWORK.ENDPOINTS.testnet;
}

// Rest of your helper functions stay the same...
export function getContractId() {
  return `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
}

export function stxToMicro(stx) {
  const amount = Number(stx);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid STX amount');
  }
  return Math.floor(amount * 1_000_000);
}

export function microToStx(micro) {
  const num = Number(micro);
  if (!Number.isFinite(num) || Number.isNaN(num) || num < 0) {
    return 0;
  }
  return num / 1_000_000;
}

export function formatStx(amount, decimals = CONFIG.UI.DECIMALS) {
  const num = Number(amount);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return '0.000000 STX';
  }
  return num.toFixed(decimals) + ' STX';
}

export function isValidStacksAddress(address, network = CONFIG.NETWORK.DEFAULT) {
  if (!address || typeof address !== 'string') return false;
  const prefix = network === 'testnet' ? 'ST' : 'SP';
  return address.startsWith(prefix) && address.length >= 39 && address.length <= 41;
}

export function shortAddress(address, start = 6, end = 4) {
  if (!address || address.length < start + end) return address || '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function isFaucetAvailable() {
  return CONFIG.FAUCET.ENABLED && CONFIG.NETWORK.DEFAULT === 'testnet';
}

export function decodeMemo(hexMemo) {
  if (!hexMemo || !hexMemo.startsWith('0x')) return '';
  
  try {
    const hex = hexMemo.slice(2);
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substr(i, 2), 16);
      if (byte !== 0) str += String.fromCharCode(byte);
    }
    return str.trim();
  } catch (e) {
    console.error('Failed to decode memo:', e);
    return '';
  }
}

export function getClarity4Features() {
  return {
    memoSupport: CONFIG.UI.SHOW_MEMO_SUPPORT,
    messageSupport: CONFIG.UI.SHOW_MESSAGE_SUPPORT,
    consensusHash: CONFIG.UI.SHOW_CONSENSUS_HASH,
    transactionHistory: true,
    stxAccount: true
  };
}

export function validateNetwork(walletAddress, expectedNetwork) {
  if (!walletAddress) return false;
  
  const isTestnet = walletAddress.startsWith('ST');
  const isMainnet = walletAddress.startsWith('SP');
  
  if (expectedNetwork === 'testnet' && !isTestnet) {
    throw new Error('Wallet is on mainnet but app expects testnet. Switch wallet network.');
  }
  
  if (expectedNetwork === 'mainnet' && !isMainnet) {
    throw new Error('Wallet is on testnet but app expects mainnet. Switch wallet network.');
  }
  
  return true;
}

export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Failed to write to localStorage:', e);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('Failed to remove from localStorage:', e);
      return false;
    }
  },
  
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
      return false;
    }
  }
};
