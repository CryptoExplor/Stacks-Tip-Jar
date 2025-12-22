// config.js - Configuration (FIXED)
export const CONFIG = {
  // Contract configuration - UPDATE THIS WITH YOUR DEPLOYED CONTRACT
  CONTRACT: {
    ADDRESS: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG', // ⚠️ UPDATE WITH YOUR ADDRESS
    NAME: 'tip-jar-v4', // ⚠️ MUST MATCH DEPLOYED CONTRACT NAME
    OWNER: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG' // ⚠️ UPDATE WITH YOUR ADDRESS
  },

  // Network configuration
  NETWORK: {
    DEFAULT: 'testnet', // 'mainnet' or 'testnet'
    ENDPOINTS: {
      mainnet: 'https://api.hiro.so',
      testnet: 'https://api.testnet.hiro.so'
    }
  },

  // Faucet configuration
  FAUCET: {
    ENABLED: true,
    ENDPOINT: 'https://api.testnet.hiro.so/extended/v1/faucets/stx',
    COOLDOWN: 300000, // 5 minutes in milliseconds
    AMOUNT: 500
  },

  // App metadata
  APP: {
    NAME: 'Stacks Tip Jar - Clarity 4 Enhanced',
    DESCRIPTION: 'Send STX tips with memos on Bitcoin L2 - Built with Clarity 4',
    ICON: '/icon.png',
    URL: typeof window !== 'undefined' ? window.location.origin : 'https://stacks-chi.vercel.app'
  },

  // Transaction settings
  TX: {
    POLLING_INTERVAL: 5000,
    CONFIRMATION_BLOCKS: 1,
    TIMEOUT: 120000 // 2 minutes
  },

  // UI settings
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

// Helper to get current network endpoint
export function getNetworkEndpoint(network = CONFIG.NETWORK.DEFAULT) {
  return CONFIG.NETWORK.ENDPOINTS[network];
}

// Helper to get full contract identifier
export function getContractId() {
  return `${CONFIG.CONTRACT.ADDRESS}.${CONFIG.CONTRACT.NAME}`;
}

// Convert STX to micro-STX with validation
export function stxToMicro(stx) {
  const amount = Number(stx);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid STX amount');
  }
  return Math.floor(amount * 1_000_000);
}

// Convert micro-STX to STX with proper handling
export function microToStx(micro) {
  const num = Number(micro);
  if (!Number.isFinite(num) || Number.isNaN(num) || num < 0) {
    return 0;
  }
  return num / 1_000_000;
}

// Format STX for display with proper decimals
export function formatStx(amount, decimals = CONFIG.UI.DECIMALS) {
  const num = Number(amount);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return '0.000000 STX';
  }
  return num.toFixed(decimals) + ' STX';
}

// Validate Stacks address
export function isValidStacksAddress(address, network = CONFIG.NETWORK.DEFAULT) {
  if (!address || typeof address !== 'string') return false;
  
  // Testnet addresses start with ST, mainnet with SP
  const prefix = network === 'testnet' ? 'ST' : 'SP';
  return address.startsWith(prefix) && address.length >= 39 && address.length <= 41;
}

// Short address display
export function shortAddress(address, start = 6, end = 4) {
  if (!address || address.length < start + end) return address || '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

// Check if faucet should be available
export function isFaucetAvailable() {
  return CONFIG.FAUCET.ENABLED && CONFIG.NETWORK.DEFAULT === 'testnet';
}

// Decode memo from hex (Clarity 4 feature)
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

// Get Clarity 4 features
export function getClarity4Features() {
  return {
    memoSupport: CONFIG.UI.SHOW_MEMO_SUPPORT,
    messageSupport: CONFIG.UI.SHOW_MESSAGE_SUPPORT,
    consensusHash: CONFIG.UI.SHOW_CONSENSUS_HASH,
    transactionHistory: true,
    stxAccount: true
  };
}

// Validate network matches wallet
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

// Safe localStorage wrapper
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
