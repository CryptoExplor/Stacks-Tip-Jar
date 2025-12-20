// ui.js - MEMORY OPTIMIZED VERSION
// Fixes: Disabled auto-refresh on history, reduced polling, better cleanup

import { CONFIG, formatStx, isFaucetAvailable, getClarity4Features, shortAddress } from './config.js';
import { walletManager } from './wallet.js';
import { contractManager } from './contract.js';

export class UIController {
  constructor() {
    this.elements = {};
    this.state = {
      loading: false,
      connected: false,
      stats: null,
      hasMessage: false,
      history: [],
      historyLimit: 5, // OPTIMIZED: Reduced from 10 to 5
      supportsHistory: true
    };
    this.faucetTimer = null;
    this.refreshTimers = []; // Track all timers for cleanup
  }

  async init() {
    console.log('🚀 Initializing UI with Clarity 4 features...');
    this.cacheElements();
    this.attachEventListeners();
    this.subscribeToWallet();

    await this.waitForWallets();
    this.checkWalletAvailability();
    await this.loadInitialData();
    
    this.updateFaucetVisibility();
    this.showClarity4Features();
    
    if (this.elements.charCount) {
      this.elements.charCount.textContent = '0';
    }
    
    console.log('✅ UI initialized');
  }

  async waitForWallets() {
    let attempts = 0;
    while (!walletManager.isReady && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

  cacheElements() {
    this.elements = {
      leatherBtn: document.getElementById('leatherBtn'),
      xverseBtn: document.getElementById('xverseBtn'),
      disconnectBtn: document.getElementById('disconnectBtn'),
      connectSection: document.getElementById('connectSection'),
      tipSection: document.getElementById('tipSection'),
      walletInfo: document.getElementById('walletInfo'),
      walletAddress: document.getElementById('walletAddress'),
      walletBadge: document.getElementById('walletBadge'),
      installNotice: document.getElementById('installNotice'),
      premiumStatus: document.getElementById('premiumStatus'),
      amountInput: document.getElementById('amount'),
      messageInput: document.getElementById('message'),
      charCount: document.getElementById('charCount'),
      sendTipBtn: document.getElementById('sendTipBtn'),
      sendTipBtnText: document.getElementById('sendTipBtnText'),
      quickAmounts: document.querySelectorAll('.quick-amount'),
      networkDisplay: document.getElementById('networkDisplay'),
      contractBalance: document.getElementById('contractBalance'),
      totalTips: document.getElementById('totalTips'),
      totalTippers: document.getElementById('totalTippers'),
      totalTransactions: document.getElementById('totalTransactions'),
      userStatsRow: document.getElementById('userStatsRow'),
      userTotalTips: document.getElementById('userTotalTips'),
      refreshBtn: document.getElementById('refreshBtn'),
      premiumInfo: document.getElementById('premiumInfo'),
      premiumProgress: document.getElementById('premiumProgress'),
      premiumProgressText: document.getElementById('premiumProgressText'),
      historySection: document.getElementById('historySection'),
      historyList: document.getElementById('historyList'),
      refreshHistoryBtn: document.getElementById('refreshHistoryBtn'),
      loadMoreBtn: document.getElementById('loadMoreBtn'),
      withdrawBtn: document.getElementById('withdrawBtn'),
      faucetBtn: document.getElementById('faucetBtn'),
      faucetSection: document.getElementById('faucetSection'),
      status: document.getElementById('status'),
    };
  }

  attachEventListeners() {
    this.elements.leatherBtn?.addEventListener('click', () => this.connectLeather());
    this.elements.xverseBtn?.addEventListener('click', () => this.connectXverse());
    this.elements.disconnectBtn?.addEventListener('click', () => this.disconnect());
    this.elements.sendTipBtn?.addEventListener('click', () => this.sendTip());
    this.elements.refreshBtn?.addEventListener('click', () => this.refreshStats());
    this.elements.refreshHistoryBtn?.addEventListener('click', () => this.refreshHistory());
    this.elements.loadMoreBtn?.addEventListener('click', () => this.loadMoreHistory());
    this.elements.withdrawBtn?.addEventListener('click', () => this.withdraw());
    this.elements.faucetBtn?.addEventListener('click', () => this.claimFaucet());

    this.elements.quickAmounts.forEach(btn => {
      btn.addEventListener('click', e => {
        const amount = e.target.dataset.amount;
        if (amount && this.elements.amountInput) {
          this.elements.amountInput.value = amount;
        }
      });
    });

    this.elements.messageInput?.addEventListener('input', e => {
      const length = e.target.value.length;
      if (this.elements.charCount) {
        this.elements.charCount.textContent = length;
      }
      
      this.state.hasMessage = length > 0;
      this.updateSendButton();
    });

    this.elements.amountInput?.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.sendTip();
      }
    });
  }

  subscribeToWallet() {
    walletManager.subscribe(async walletState => {
      console.log('👛 Wallet state changed:', walletState);
      this.state.connected = walletState.connected;
      
      if (walletState.connected && walletState.address) {
        try {
          const stats = await contractManager.getUserStats(walletState.address);
          if (stats) {
            walletState.isPremium = stats.isPremium || false;
            walletState.userStats = stats;
            console.log('👤 Fetched user stats:', stats);
            this.updatePremiumInfo(stats);
          }
        } catch (error) {
          console.error('Failed to fetch user stats:', error);
          walletState.isPremium = false;
        }
      }
      
      this.updateWalletUI(walletState);
      this.updateFaucetButton();
      
      if (walletState.connected) {
        this.loadHistory();
      }
    });
  }

  updatePremiumInfo(stats) {
    if (!stats || !this.elements.premiumInfo) return;
    
    const threshold = 10;
    const current = stats.totalTipped || 0;
    const isPremium = stats.isPremium || false;
    
    if (isPremium) {
      this.elements.premiumInfo.style.display = 'none';
    } else {
      this.elements.premiumInfo.style.display = 'block';
      const percentage = Math.min((current / threshold) * 100, 100);
      
      if (this.elements.premiumProgress) {
        this.elements.premiumProgress.style.width = `${percentage}%`;
      }
      
      if (this.elements.premiumProgressText) {
        this.elements.premiumProgressText.textContent = 
          `${current.toFixed(2)} / ${threshold} STX`;
      }
    }
  }

  checkWalletAvailability() {
    console.log('🔍 Checking wallet availability...');
    const availability = walletManager.checkAvailability();
    console.log('📋 Availability:', availability);

    if (!availability.leather && !availability.xverse) {
      this.elements.installNotice?.classList.add('show');
      console.log('⚠️ No wallets detected - showing install notice');
    }

    if (!availability.leather && this.elements.leatherBtn) {
      this.elements.leatherBtn.disabled = true;
      this.elements.leatherBtn.title = 'Leather wallet not installed';
    }

    if (!availability.xverse && this.elements.xverseBtn) {
      this.elements.xverseBtn.disabled = true;
      this.elements.xverseBtn.title = 'Xverse wallet not installed';
    }
  }

  async loadInitialData() {
    console.log('📊 Loading initial data...');
    await this.refreshStats();
    await this.checkHistorySupport();
    await this.loadHistory();

    if (this.elements.networkDisplay) {
      const network = CONFIG.NETWORK.DEFAULT;
      this.elements.networkDisplay.textContent =
        network.charAt(0).toUpperCase() + network.slice(1);
    }
  }

  async checkHistorySupport() {
    try {
      await contractManager.callReadOnly('get-total-transactions', [], CONFIG.NETWORK.DEFAULT);
      this.state.supportsHistory = true;
      console.log('✅ Contract supports transaction history');
    } catch (error) {
      this.state.supportsHistory = false;
      console.log('⚠️ Contract does not support transaction history');
      
      if (this.elements.historySection) {
        this.elements.historySection.style.display = 'none';
      }
    }
  }

  showClarity4Features() {
    const features = getClarity4Features();
    console.log('✨ Clarity 4 features available:', features);
  }

  updateSendButton() {
    if (!this.elements.sendTipBtnText) return;
    
    if (this.state.hasMessage) {
      this.elements.sendTipBtnText.textContent = 'Send Tip with Message';
      this.elements.sendTipBtn.classList.add('has-message');
    } else {
      this.elements.sendTipBtnText.textContent = 'Send Tip';
      this.elements.sendTipBtn.classList.remove('has-message');
    }
  }

  updateFaucetVisibility() {
    if (this.elements.faucetSection) {
      if (isFaucetAvailable()) {
        this.elements.faucetSection.style.display = 'block';
      } else {
        this.elements.faucetSection.style.display = 'none';
      }
    }
  }

  updateFaucetButton() {
    if (!this.elements.faucetBtn) return;

    const faucetStatus = walletManager.canClaimFaucet();
    
    if (faucetStatus.canClaim) {
      this.elements.faucetBtn.disabled = false;
      this.elements.faucetBtn.innerHTML = '<span class="btn-icon">💰</span><span>Claim 500 STX from Faucet</span>';
      
      if (this.faucetTimer) {
        clearInterval(this.faucetTimer);
        this.faucetTimer = null;
      }
    } else if (faucetStatus.remainingSeconds) {
      this.elements.faucetBtn.disabled = true;
      this.startFaucetCountdown(faucetStatus.remainingSeconds);
    } else {
      this.elements.faucetBtn.disabled = true;
      this.elements.faucetBtn.innerHTML = '<span class="btn-icon">💰</span><span>Connect wallet to claim</span>';
    }
  }

  startFaucetCountdown(seconds) {
    if (this.faucetTimer) {
      clearInterval(this.faucetTimer);
    }

    let remaining = seconds;
    
    const updateButton = () => {
      if (remaining <= 0) {
        clearInterval(this.faucetTimer);
        this.faucetTimer = null;
        this.updateFaucetButton();
        return;
      }
      
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      
      if (this.elements.faucetBtn) {
        this.elements.faucetBtn.innerHTML = `<span class="btn-icon">⏰</span><span>Wait ${timeStr}</span>`;
      }
      
      remaining--;
    };

    updateButton();
    this.faucetTimer = setInterval(updateButton, 1000);
  }

  // OPTIMIZED: Simpler history loading
  async loadHistory() {
    console.log('📜 Loading transaction history...');
    
    if (!this.elements.historyList) return;
    
    if (!this.state.supportsHistory) {
      console.log('⚠️ History not supported by contract');
      this.elements.historyList.innerHTML = 
        '<div class="history-empty">Transaction history not available with this contract version</div>';
      return;
    }
    
    this.elements.historyList.innerHTML = '<div class="history-loading">Loading transaction history...</div>';
    
    try {
      const history = await contractManager.getHistory(this.state.historyLimit);
      this.state.history = history;
      
      if (history.length === 0) {
        this.elements.historyList.innerHTML = '<div class="history-empty">No tips yet. Be the first to send one! 🚀</div>';
      } else {
        this.renderHistory(history);
        
        if (this.elements.loadMoreBtn && history.length === this.state.historyLimit) {
          this.elements.loadMoreBtn.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('❌ Failed to load history:', error);
      this.elements.historyList.innerHTML = '<div class="history-empty">Failed to load transaction history</div>';
    }
  }

  renderHistory(transactions) {
    if (!this.elements.historyList) return;
    
    this.elements.historyList.innerHTML = '';
    
    transactions.forEach(tx => {
      const item = this.createHistoryItem(tx);
      this.elements.historyList.appendChild(item);
    });
  }

  createHistoryItem(tx) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const header = document.createElement('div');
    header.className = 'history-item-header';
    
    const tipper = document.createElement('div');
    tipper.className = 'history-item-tipper';
    tipper.textContent = shortAddress(tx.tipper);
    
    const amount = document.createElement('div');
    amount.className = 'history-item-amount';
    amount.textContent = formatStx(tx.amount);
    
    header.appendChild(tipper);
    header.appendChild(amount);
    
    const meta = document.createElement('div');
    meta.className = 'history-item-meta';
    
    const blockMeta = document.createElement('div');
    blockMeta.className = 'history-item-meta-item';
    blockMeta.innerHTML = `
      <span class="history-item-meta-icon">📦</span>
      <span>Block ${tx.blockHeight}</span>
    `;
    meta.appendChild(blockMeta);
    
    const txMeta = document.createElement('div');
    txMeta.className = 'history-item-meta-item';
    txMeta.innerHTML = `
      <span class="history-item-meta-icon">#️⃣</span>
      <span>TX ${tx.txId}</span>
    `;
    meta.appendChild(txMeta);
    
    if (tx.hasMessage) {
      const messageMeta = document.createElement('div');
      messageMeta.className = 'history-item-meta-item';
      messageMeta.innerHTML = `
        <span class="message-badge">📝 HAS MESSAGE</span>
      `;
      meta.appendChild(messageMeta);
    }
    
    item.appendChild(header);
    item.appendChild(meta);
    
    return item;
  }

  async refreshHistory() {
    console.log('🔄 Refreshing history...');
    
    if (this.elements.refreshHistoryBtn) {
      this.elements.refreshHistoryBtn.disabled = true;
    }
    
    try {
      contractManager.clearCache(); // Force fresh data
      await this.loadHistory();
    } finally {
      if (this.elements.refreshHistoryBtn) {
        this.elements.refreshHistoryBtn.disabled = false;
      }
    }
  }

  async loadMoreHistory() {
    this.state.historyLimit += 5; // OPTIMIZED: Load 5 more at a time
    await this.loadHistory();
  }

  async connectLeather() {
    console.log('🦊 Connect Leather clicked');
    this.setLoading(true);
    this.showStatus('Connecting to Leather...', 'info');

    try {
      await walletManager.connectLeather();
      this.showStatus(`Connected with Leather!`, 'success');
      await this.loadHistory();
    } catch (error) {
      console.error('❌ Leather connection failed:', error);
      this.showStatus(
        error.message || 'Failed to connect to Leather wallet',
        'error',
      );
    } finally {
      this.setLoading(false);
    }
  }

  async connectXverse() {
    console.log('⚡ Connect Xverse clicked');
    this.setLoading(true);
    this.showStatus('Connecting to Xverse...', 'info');

    try {
      await walletManager.connectXverse();
      this.showStatus(`Connected with Xverse!`, 'success');
      await this.loadHistory();
    } catch (error) {
      console.error('❌ Xverse connection failed:', error);
      this.showStatus(
        error.message || 'Failed to connect to Xverse wallet',
        'error',
      );
    } finally {
      this.setLoading(false);
    }
  }

  disconnect() {
    console.log('🔌 Disconnect clicked');
    walletManager.disconnect();
    this.showStatus('Wallet disconnected', 'info');
    
    // OPTIMIZED: Clear all timers
    this.clearAllTimers();
    
    this.state.history = [];
    if (this.elements.historyList) {
      this.elements.historyList.innerHTML = '<div class="history-empty">Connect wallet to view history</div>';
    }
  }

  updateWalletUI(walletState) {
    const isOwner = walletState.address === CONFIG.CONTRACT.OWNER;

    if (walletState.connected) {
      console.log('✅ Showing connected UI');

      if (this.elements.walletAddress) {
        this.elements.walletAddress.textContent = walletState.address;
      }
      if (this.elements.walletBadge) {
        const badge = walletState.walletType.charAt(0).toUpperCase() + walletState.walletType.slice(1);
        this.elements.walletBadge.textContent = isOwner
          ? `${badge} • Owner`
          : badge;
      }

      if (this.elements.premiumStatus) {
        if (walletState.isPremium) {
          this.elements.premiumStatus.style.display = 'flex';
        } else {
          this.elements.premiumStatus.style.display = 'none';
        }
      }

      if (walletState.userStats && this.elements.userStatsRow) {
        this.elements.userStatsRow.style.display = 'flex';
        if (this.elements.userTotalTips) {
          this.elements.userTotalTips.textContent = formatStx(walletState.userStats.totalTipped);
        }
      }

      this.elements.walletInfo?.classList.add('show');
      this.elements.connectSection?.classList.remove('show');
      this.elements.tipSection?.classList.add('show');

      if (this.elements.withdrawBtn) {
        this.elements.withdrawBtn.style.display = isOwner ? 'block' : 'none';
      }
    } else {
      console.log('❌ Showing disconnected UI');

      this.elements.walletInfo?.classList.remove('show');
      this.elements.connectSection?.classList.add('show');
      this.elements.tipSection?.classList.remove('show');

      if (this.elements.withdrawBtn) {
        this.elements.withdrawBtn.style.display = 'none';
      }
      
      if (this.elements.premiumStatus) {
        this.elements.premiumStatus.style.display = 'none';
      }
      
      if (this.elements.userStatsRow) {
        this.elements.userStatsRow.style.display = 'none';
      }
    }
  }

  async claimFaucet() {
    console.log('💰 Claim faucet clicked');

    if (!walletManager.address) {
      this.showStatus('Please connect your wallet first', 'error');
      return;
    }

    this.setLoading(true);
    this.showStatus('Claiming from faucet...', 'info');

    try {
      const result = await walletManager.claimFaucet();
      console.log('✅ Faucet claim result:', result);

      const shortTxId = result.txId
        ? result.txId.substring(0, 8) + '...'
        : '';

      this.showStatus(
        `✅ Claimed 500 STX! ${shortTxId ? 'TX: ' + shortTxId : ''} Check your wallet in ~30 seconds.`,
        'success',
      );

      this.updateFaucetButton();
      
      // OPTIMIZED: Single delayed refresh
      const timer = setTimeout(() => this.refreshStats(), 10000);
      this.refreshTimers.push(timer);
    } catch (error) {
      console.error('❌ Faucet claim failed:', error);
      
      let errorMsg = error.message || 'Failed to claim from faucet';
      
      if (errorMsg.includes('unavailable') || errorMsg.includes('500')) {
        errorMsg += ' Use the manual faucet: https://explorer.hiro.so/sandbox/faucet?chain=testnet';
      }
      
      this.showStatus(errorMsg, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async sendTip() {
    console.log('💸 Send tip clicked');

    const amount = parseFloat(this.elements.amountInput?.value || 0);
    const message = this.elements.messageInput?.value?.trim() || '';

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

    if (message) {
      this.showStatus('Preparing transaction with custom message (Clarity 4)...', 'info');
    } else {
      this.showStatus('Preparing transaction with memo (Clarity 4)...', 'info');
    }

    try {
      const result = message 
        ? await walletManager.sendTipWithMessage(amount, message)
        : await walletManager.sendTip(amount);
        
      console.log('✅ Transaction result:', result);

      const shortTxId = result.txId
        ? result.txId.substring(0, 8) + '...'
        : 'sent';

      const successMsg = message
        ? `✅ Tip with message sent! TX: ${shortTxId} - Memo and message stored on-chain`
        : `✅ Tip sent! TX: ${shortTxId} - Memo stored on-chain`;

      this.showStatus(successMsg, 'success');

      if (this.elements.amountInput) {
        this.elements.amountInput.value = '';
      }
      if (this.elements.messageInput) {
        this.elements.messageInput.value = '';
        if (this.elements.charCount) {
          this.elements.charCount.textContent = '0';
        }
      }
      this.state.hasMessage = false;
      this.updateSendButton();

      contractManager.clearCache();
      
      // OPTIMIZED: Reduced refresh frequency
      const timer1 = setTimeout(() => this.refreshStats(), 5000);
      const timer2 = setTimeout(() => this.refreshHistory(), 10000);
      this.refreshTimers.push(timer1, timer2);
    } catch (error) {
      console.error('❌ Send tip failed:', error);
      if (error.message && error.message.toLowerCase().includes('cancel')) {
        this.showStatus('Transaction cancelled', 'info');
      } else {
        this.showStatus(
          'Transaction failed: ' + (error.message || 'Unknown error'),
          'error',
        );
      }
    } finally {
      this.setLoading(false);
    }
  }

  async withdraw() {
    console.log('⬇️ Withdraw clicked');

    if (!walletManager.address) {
      this.showStatus('Please connect your wallet first', 'error');
      return;
    }

    if (walletManager.address !== CONFIG.CONTRACT.OWNER) {
      this.showStatus('Only the contract owner can withdraw', 'error');
      return;
    }

    const balance = this.state.stats?.balance || 0;
    if (!balance || balance <= 0) {
      this.showStatus('Nothing to withdraw – balance is 0', 'error');
      return;
    }

    this.setLoading(true);
    this.showStatus('Preparing withdrawal with memo (Clarity 4)...', 'info');

    try {
      const result = await walletManager.withdraw();
      console.log('✅ Withdraw result:', result);

      const shortTxId = result.txId
        ? result.txId.substring(0, 8) + '...'
        : 'sent';

      this.showStatus(`Withdrawal sent! TX: ${shortTxId} - Memo stored on-chain`, 'success');

      const timer = setTimeout(() => this.refreshStats(), CONFIG.TX.POLLING_INTERVAL);
      this.refreshTimers.push(timer);
    } catch (error) {
      console.error('❌ Withdraw failed:', error);
      if (error.message && error.message.toLowerCase().includes('cancel')) {
        this.showStatus('Withdrawal cancelled', 'info');
      } else {
        this.showStatus(
          'Withdrawal failed: ' + (error.message || 'Unknown error'),
          'error',
        );
      }
    } finally {
      this.setLoading(false);
    }
  }

  async refreshStats() {
    console.log('🔄 Refreshing stats...');
    this.showStatus('Refreshing stats...', 'info');

    try {
      const userAddress = walletManager.address;
      const stats = await contractManager.getStats(CONFIG.NETWORK.DEFAULT, true, userAddress);
      console.log('📊 Stats:', stats);
      this.state.stats = stats;

      if (this.elements.contractBalance) {
        this.elements.contractBalance.textContent = formatStx(stats.balance || 0);
      }
      if (this.elements.totalTips) {
        this.elements.totalTips.textContent = formatStx(stats.totalTips || 0);
      }
      if (this.elements.totalTippers) {
        this.elements.totalTippers.textContent = stats.totalTippers || 0;
      }
      if (this.elements.totalTransactions) {
        this.elements.totalTransactions.textContent = stats.totalTransactions || 0;
      }

      if (stats.userStats) {
        this.updatePremiumInfo(stats.userStats);
        
        if (this.elements.userStatsRow) {
          this.elements.userStatsRow.style.display = 'flex';
        }
        if (this.elements.userTotalTips) {
          this.elements.userTotalTips.textContent = formatStx(stats.userStats.totalTipped || 0);
        }
      }

      this.showStatus('Stats updated', 'success');
    } catch (error) {
      console.error('❌ Failed to refresh stats:', error);
      this.showStatus('Failed to load contract data', 'error');

      if (this.elements.contractBalance) {
        this.elements.contractBalance.textContent = '--';
      }
      if (this.elements.totalTips) {
        this.elements.totalTips.textContent = '--';
      }
    }
  }

  showStatus(message, type = 'info') {
    console.log(`📢 Status [${type}]:`, message);
    if (!this.elements.status) return;

    this.elements.status.textContent = message;
    this.elements.status.className = `status show ${type}`;

    if (type === 'success' || type === 'info') {
      const timer = setTimeout(() => {
        this.elements.status.classList.remove('show');
      }, 5000);
      this.refreshTimers.push(timer);
    }
  }

  setLoading(loading) {
    console.log('⏳ Loading:', loading);
    this.state.loading = loading;

    const buttons = [
      this.elements.leatherBtn,
      this.elements.xverseBtn,
      this.elements.sendTipBtn,
      this.elements.refreshBtn,
      this.elements.withdrawBtn,
      this.elements.faucetBtn,
      this.elements.refreshHistoryBtn
    ];

    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = loading;
      }
    });
    
    if (!loading) {
      setTimeout(() => this.updateFaucetButton(), 100);
    }
  }

  // OPTIMIZED: Cleanup timers to prevent memory leaks
  clearAllTimers() {
    if (this.faucetTimer) {
      clearInterval(this.faucetTimer);
      this.faucetTimer = null;
    }
    
    this.refreshTimers.forEach(timer => clearTimeout(timer));
    this.refreshTimers = [];
  }

  // Cleanup on destruction
  cleanup() {
    this.clearAllTimers();
    contractManager.cleanup();
  }
}

export const uiController = new UIController();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    uiController.cleanup();
  });
}
