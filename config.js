// config.js - Configuration for Clarity 4 Enhanced Contract
export const CONFIG = {
  // Contract configuration - UPDATE THIS WITH YOUR NEW CONTRACT ADDRESS
  CONTRACT: {
    ADDRESS: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG', // ⚠️ UPDATE WITH YOUR ADDRESS
    NAME: 'tip-jar-v4', // ⚠️ UPDATE WITH YOUR CONTRACT NAME
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
    COOLDOWN: 300000, // 5 minutes
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
    CONFIRMATION_BLOCKS: 1
  },

  // UI settings
  UI: {
    QUICK_AMOUNTS: [0.1, 0.5, 1, 5],
    MIN_TIP: 0.000001,
    DECIMALS: 6,
    // NEW: Show Clarity 4 features
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

// Convert STX to micro-STX
export function stxToMicro(stx) {
  return Math.floor(Number(stx) * 1_000_000);
}

// Convert micro-STX to STX with proper handling
export function microToStx(micro) {
  const num = Number(micro);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
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
  
  if (network === 'testnet') {
    return address.startsWith('ST') && address.length >= 39;
  } else {
    return address.startsWith('SP') && address.length >= 39;
  }
}

// Short address display
export function shortAddress(address, start = 6, end = 4) {
  if (!address) return '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

// Check if faucet should be available
export function isFaucetAvailable() {
  return CONFIG.FAUCET.ENABLED && CONFIG.NETWORK.DEFAULT === 'testnet';
}

// NEW: Decode memo from hex (Clarity 4 feature)
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
    return '';
  }
}

// NEW: Check if contract supports Clarity 4 features
export function getClarity4Features() {
  return {
    memoSupport: CONFIG.UI.SHOW_MEMO_SUPPORT,
    messageSupport: CONFIG.UI.SHOW_MESSAGE_SUPPORT,
    consensusHash: CONFIG.UI.SHOW_CONSENSUS_HASH,
    stxAccount: true
  };
}
