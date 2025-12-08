// ui.js - UI controller with wallet detection fix
import { CONFIG, formatStx, shortAddress } from './config.js';
import { walletManager } from './wallet.js';
import { contractManager } from './contract.js';

export class UIController {
  constructor() {
    this.elements = {};
    this.state = {
      loading: false,
      connected: false,
      stats: null
    };
  }

  // Initialize UI
  async init() {
    console.log('🚀 Initializing UI...');
    this.cacheElements();
    this.attachEventListeners();
    this.subscribeToWallet();
    
    // Wait for wallets to be ready
    await this.waitForWallets();
    
    this.checkWalletAvailability();
    await this.loadInitialData();
    console.log('✅ UI initialized');
  }

  // Wait for wallet manager to be ready
  async waitForWallets() {
    let attempts = 0;
    while (!walletManager.isReady && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

  // Cache DOM elements
  cacheElements() {
    this.elements = {
      // Wallet connection
      leatherBtn: document.getElementById('leatherBtn'),
      xverseBtn: document.getElementById('xverseBtn'),
      disconnectBtn: document.getElementById('disconnectBtn'),
      connectSection: document.getElementById('connectSection'),
      tipSection: document.getElementById('tipSection'),
      walletInfo: document.getElementById('walletInfo'),
      walletAddress: document.getElementById('walletAddress'),
      walletBadge: document.getElementById('walletBadge'),
      installNotice: document.getElementById('installNotice'),

      // Tip sending
      amountInput: document.getElementById('amount'),
      sendTipBtn: document.getElementById('sendTipBtn'),
      quickAmounts: document.querySelectorAll('.quick-amount'),

      // Stats
      networkDisplay: document.getElementById('networkDisplay'),
      contractBalance: document.getElementById('contractBalance'),
      totalTips: document.getElementById('totalTips'),
      refreshBtn: document.getElementById('refreshBtn'),

      // Status
      status: document.getElementById('status')
    };
  }

  // Attach event listeners
  attachEventListeners() {
    // Wallet connection buttons
    this.elements.leatherBtn?.addEventListener('click', () => this.connectLeather());
    this.elements.xverseBtn?.addEventListener('click', () => this.connectXverse());
    this.elements.disconnectBtn?.addEventListener('click', () => this.disconnect());

    // Tip sending
    this.elements.sendTipBtn?.addEventListener('click', () => this.sendTip());
    this.elements.refreshBtn?.addEventListener('click', () => this.refreshStats());

    // Quick amount buttons
    this.elements.quickAmounts.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const amount = e.target.dataset.amount;
        if (amount && this.elements.amountInput) {
          this.elements.amountInput.value = amount;
        }
      });
    });

    // Enter key on amount input
    this.elements.amountInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendTip();
      }
    });
  }

  // Subscribe to wallet state changes
  subscribeToWallet() {
    walletManager.subscribe((walletState) => {
      console.log('👛 Wallet state changed:', walletState);
      this.state.connected = walletState.connected;
      this.updateWalletUI(walletState);
    });
  }

  // Check wallet availability
  checkWalletAvailability() {
    console.log('🔍 Checking wallet availability...');
    const availability = walletManager.checkAvailability();
    console.log('📋 Availability:', availability);
    
    if (!availability.leather && !availability.xverse) {
      this.elements.installNotice?.classList.add('show');
      console.log('⚠️ No wallets detected - showing install notice');
    }

    // Disable buttons for unavailable wallets
    if (!availability.leather && this.elements.leatherBtn) {
      this.elements.leatherBtn.disabled = true;
      this.elements.leatherBtn.title = 'Leather wallet not installed';
      console.log('❌ Leather not available');
    } else {
      console.log('✅ Leather available');
    }

    if (!availability.xverse && this.elements.xverseBtn) {
      this.elements.xverseBtn.disabled = true;
      this.elements.xverseBtn.title = 'Xverse wallet not installed';
      console.log('❌ Xverse not available');
    } else {
      console.log('✅ Xverse available');
    }
  }

  // Load initial data
  async loadInitialData() {
    console.log('📊 Loading initial data...');
    await this.refreshStats();
    
    // Update network display
    if (this.elements.networkDisplay) {
      const network = CONFIG.NETWORK.DEFAULT;
      this.elements.networkDisplay.textContent = 
        network.charAt(0).toUpperCase() + network.slice(1);
    }
  }

  // Connect Leather wallet
  async connectLeather() {
    console.log('🦊 Connect Leather clicked');
    this.setLoading(true);
    this.showStatus('Connecting to Leather...', 'info');

    try {
      const result = await walletManager.connectLeather();
      this.showStatus(`Connected with Leather!`, 'success');
    } catch (error) {
      console.error('❌ Leather connection failed:', error);
      this.showStatus(
        error.message || 'Failed to connect to Leather wallet',
        'error'
      );
    } finally {
      this.setLoading(false);
    }
  }

  // Connect Xverse wallet
  async connectXverse() {
    console.log('⚡ Connect Xverse clicked');
    this.setLoading(true);
    this.showStatus('Connecting to Xverse...', 'info');

    try {
      const result = await walletManager.connectXverse();
      this.showStatus(`Connected with Xverse!`, 'success');
    } catch (error) {
      console.error('❌ Xverse connection failed:', error);
      this.showStatus(
        error.message || 'Failed to connect to Xverse wallet',
        'error'
      );
    } finally {
      this.setLoading(false);
    }
  }

  // Disconnect wallet
  disconnect() {
    console.log('🔌 Disconnect clicked');
    walletManager.disconnect();
    this.showStatus('Wallet disconnected', 'info');
  }

  // Update wallet UI
  updateWalletUI(walletState) {
    if (walletState.connected) {
      console.log('✅ Showing connected UI');
      
      // Show wallet info
      if (this.elements.walletAddress) {
        this.elements.walletAddress.textContent = walletState.address;
      }
      
      if (this.elements.walletBadge) {
        this.elements.walletBadge.textContent = walletState.walletType;
      }
      
      this.elements.walletInfo?.classList.add('show');
      this.elements.connectSection?.classList.remove('show');
      this.elements.tipSection?.classList.add('show');
    } else {
      console.log('❌ Showing disconnected UI');
      
      // Hide wallet info
      this.elements.walletInfo?.classList.remove('show');
      this.elements.connectSection?.classList.add('show');
      this.elements.tipSection?.classList.remove('show');
    }
  }

  // Send tip
  async sendTip() {
    console.log('💸 Send tip clicked');
    
    const amount = parseFloat(this.elements.amountInput?.value || 0);
    console.log('💰 Amount:', amount);

    if (!amount || amount <= 0) {
      this.showStatus('Please enter a valid tip amount', 'error');
      return;
    }

    if (amount < CONFIG.UI.MIN_TIP) {
      this.showStatus(`Minimum tip is ${CONFIG.UI.MIN_TIP} STX`, 'error');
      return;
    }

    if (!walletManager.address) {
      this.showStatus('Please connect your wallet first', 'error');
      return;
    }

    this.setLoading(true);
    this.showStatus('Preparing transaction...', 'info');

    try {
      console.log('📤 Calling walletManager.sendTip...');
      const result = await walletManager.sendTip(amount);
      console.log('✅ Transaction result:', result);
      
      const shortTxId = result.txId 
        ? result.txId.substring(0, 8) + '...' 
        : 'sent';
      
      this.showStatus(
        `Tip sent successfully! TX: ${shortTxId}`,
        'success'
      );

      // Clear amount input
      if (this.elements.amountInput) {
        this.elements.amountInput.value = '';
      }

      // Refresh stats after delay
      setTimeout(() => this.refreshStats(), CONFIG.TX.POLLING_INTERVAL);
    } catch (error) {
      console.error('❌ Send tip failed:', error);
      
      if (error.message.includes('cancel')) {
        this.showStatus('Transaction cancelled', 'info');
      } else {
        this.showStatus(
          'Transaction failed: ' + (error.message || 'Unknown error'),
          'error'
        );
      }
    } finally {
      this.setLoading(false);
    }
  }

  // Refresh contract stats
  async refreshStats() {
    console.log('🔄 Refreshing stats...');
    this.showStatus('Refreshing stats...', 'info');

    try {
      const stats = await contractManager.getStats(CONFIG.NETWORK.DEFAULT, true);
      console.log('📊 Stats:', stats);
      
      this.state.stats = stats;
      
      // Update UI
      if (this.elements.contractBalance) {
        this.elements.contractBalance.textContent = 
          formatStx(stats.balance || 0);
      }
      
      if (this.elements.totalTips) {
        this.elements.totalTips.textContent = 
          formatStx(stats.totalTips || 0);
      }

      this.showStatus('Stats updated', 'success');
    } catch (error) {
      console.error('❌ Failed to refresh stats:', error);
      this.showStatus('Failed to load contract data', 'error');
      
      // Show placeholder values
      if (this.elements.contractBalance) {
        this.elements.contractBalance.textContent = '--';
      }
      if (this.elements.totalTips) {
        this.elements.totalTips.textContent = '--';
      }
    }
  }

  // Show status message
  showStatus(message, type = 'info') {
    console.log(`📢 Status [${type}]:`, message);
    
    if (!this.elements.status) return;

    this.elements.status.textContent = message;
    this.elements.status.className = `status show ${type}`;

    // Auto-hide success/info messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        this.elements.status.classList.remove('show');
      }, 5000);
    }
  }

  // Set loading state
  setLoading(loading) {
    console.log('⏳ Loading:', loading);
    this.state.loading = loading;
    
    // Disable/enable buttons
    const buttons = [
      this.elements.leatherBtn,
      this.elements.xverseBtn,
      this.elements.sendTipBtn,
      this.elements.refreshBtn
    ];

    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = loading;
      }
    });
  }
}

// Export singleton instance
export const uiController = new UIController();
