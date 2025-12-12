// ui.js - UI controller with transaction history support
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
      historyLimit: 10
    };
    this.faucetTimer = null;
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
      messageInput: document.getElementById('message'),
      charCount: document.getElementById('charCount'),
      sendTipBtn: document.getElementById('sendTipBtn'),
      sendTipBtnText: document.getElementById('sendTipBtnText'),
      quickAmounts: document.querySelectorAll('.quick-amount'),

      // Stats
      networkDisplay: document.getElementById('networkDisplay'),
      contractBalance: document.getElementById('contractBalance'),
      totalTips: document.getElementById('totalTips'),
      totalTippers: document.getElementById('totalTippers'),
      totalTransactions: document.getElementById('totalTransactions'),
      refreshBtn: document.getElementById('refreshBtn'),

      // History
      historySection: document.getElementById('historySection'),
      historyList: document.getElementById('historyList'),
      refreshHistoryBtn: document.getElementById('refreshHistoryBtn'),
      loadMoreBtn: document.getElementById('loadMoreBtn'),

      // Owner-only withdraw
      withdrawBtn: document.getElementById('withdrawBtn'),

      // Faucet
      faucetBtn: document.getElementById('faucetBtn'),
      faucetSection: document.getElementById('faucetSection'),

      // Status
      status: document.getElementById('status'),
    };
  }

  attachEventListeners() {
    // Wallet connection buttons
    this.elements.leatherBtn?.addEventListener('click', () => this.connectLeather());
    this.elements.xverseBtn?.addEventListener('click', () => this.connectXverse());
    this.elements.disconnectBtn?.addEventListener('click', () => this.disconnect());

    // Tip sending
    this.elements.sendTipBtn?.addEventListener('click', () => this.sendTip());
    this.elements.refreshBtn?.addEventListener('click', () => this.refreshStats());

    // History
    this.elements.refreshHistoryBtn?.addEventListener('click', () => this.refreshHistory());
    this.elements.loadMoreBtn?.addEventListener('click', () => this.loadMoreHistory());

    // Withdraw
    this.elements.withdrawBtn?.addEventListener('click', () => this.withdraw());

    // Faucet
    this.elements.faucetBtn?.addEventListener('click', () => this.claimFaucet());

    // Quick amount buttons
    this.elements.quickAmounts.forEach(btn => {
      btn.addEventListener('click', e => {
        const amount = e.target.dataset.amount;
        if (amount && this.elements.amountInput) {
          this.elements.amountInput.value = amount;
        }
      });
    });

    // Message character counter
    this.elements.messageInput?.addEventListener('input', e => {
      const length = e.target.value.length;
      if (this.elements.charCount) {
        this.elements.charCount.textContent = length;
      }
      
      this.state.hasMessage = length > 0;
      this.updateSendButton();
    });

    // Enter key on amount input
    this.elements.amountInput?.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.sendTip();
      }
    });
  }

  subscribeToWallet() {
    walletManager.subscribe(walletState => {
      console.log('👛 Wallet state changed:', walletState);
      this.state.connected = walletState.connected;
      this.updateWalletUI(walletState);
      this.updateFaucetButton();
      
      if (walletState.connected) {
        this.loadHistory();
      }
    });
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
    await this.loadHistory();

    if (this.elements.networkDisplay) {
      const network = CONFIG.NETWORK.DEFAULT;
      this.elements.networkDisplay.textContent =
        network.charAt(0).toUpperCase() + network.slice(1);
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

  // NEW: Load transaction history
  async loadHistory() {
    console.log('📜 Loading transaction history...');
    
    if (!this.elements.historyList) return;
    
    this.elements.historyList.innerHTML = '<div class="history-loading">Loading transaction history...</div>';
    
    try {
      const history = await contractManager.getHistory(this.state.historyLimit);
      this.state.history = history;
      
      if (history.length === 0) {
        this.elements.historyList.innerHTML = '<div class="history-empty">No tips yet. Be the first to send one! 🚀</div>';
      } else {
        this.renderHistory(history);
      }
    } catch (error) {
      console.error('❌ Failed to load history:', error);
      this.elements.historyList.innerHTML = '<div class="history-empty">Failed to load transaction history</div>';
    }
  }

  // NEW: Render history items
  renderHistory(transactions) {
    if (!this.elements.historyList) return;
    
    this.elements.historyList.innerHTML = '';
    
    transactions.forEach(tx => {
      const item = this.createHistoryItem(tx);
      this.elements.historyList.appendChild(item);
    });
  }

  // NEW: Create a single history item
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
    
    // Block height
    const blockMeta = document.createElement('div');
    blockMeta.className = 'history-item-meta-item';
    blockMeta.innerHTML = `
      <span class="history-item-meta-icon">📦</span>
      <span>Block ${tx.blockHeight}</span>
    `;
    meta.appendChild(blockMeta);
    
    // Transaction ID
    const txMeta = document.createElement('div');
    txMeta.className = 'history-item-meta-item';
    txMeta.innerHTML = `
      <span class="history-item-meta-icon">#️⃣</span>
      <span>TX ${tx.txId}</span>
    `;
    meta.appendChild(txMeta);
    
    // Has message badge
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

  // NEW: Refresh history
  async refreshHistory() {
    console.log('🔄 Refreshing history...');
    
    if (this.elements.refreshHistoryBtn) {
      this.elements.refreshHistoryBtn.disabled = true;
    }
    
    try {
      await this.loadHistory();
    } finally {
      if (this.elements.refreshHistoryBtn) {
        this.elements.refreshHistoryBtn.disabled = false;
      }
    }
  }

  // NEW: Load more history
  async loadMoreHistory() {
    this.state.historyLimit += 10;
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
    
    if (this.faucetTimer) {
      clearInterval(this.faucetTimer);
      this.faucetTimer = null;
    }
    
    // Clear history
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
      setTimeout(() => this.refreshStats(), 10000);
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

      // Clear inputs
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
      setTimeout(() => this.refreshStats(), 3000);
      setTimeout(() => this.refreshHistory(), 5000);
      setTimeout(() => this.refreshStats(), 10000);
      setTimeout(() => this.refreshHistory(), 15000);
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

      setTimeout(() => this.refreshStats(), CONFIG.TX.POLLING_INTERVAL);
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
      const stats = await contractManager.getStats(CONFIG.NETWORK.DEFAULT, true);
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
      setTimeout(() => {
        this.elements.status.classList.remove('show');
      }, 5000);
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
}

export const uiController = new UIController();
