// config.js - Configuration
export const CONFIG = {
  // Contract configuration
  CONTRACT: {
    ADDRESS: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG',
    NAME: 'tip-jar-v2',
    OWNER: 'ST3ZQXJPR493FCYNAVFX1YSK7EMT6JF909E3SDNQG'
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
    NAME: 'Stacks Tip Jar',
    DESCRIPTION: 'Send STX tips on Bitcoin L2 - Built with Clarity 4',
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
    DECIMALS: 6
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
