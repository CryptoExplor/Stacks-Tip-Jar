// main.js - Application entry point
import { CONFIG } from './config.js';
import { uiController } from './ui.js';

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  console.log('Initializing Stacks Tip Jar...');
  console.log('Network:', CONFIG.NETWORK.DEFAULT);
  console.log('Contract:', CONFIG.CONTRACT.ADDRESS);
  
  // Initialize UI controller
  uiController.init();
  
  // Set up Farcaster Frame metadata if enabled
  if (CONFIG.FARCASTER.ENABLED) {
    setupFarcasterFrame();
  }
  
  console.log('App initialized successfully');
}

// Setup Farcaster Frame metadata
function setupFarcasterFrame() {
  const meta = {
    'fc:frame': CONFIG.FARCASTER.FRAME_VERSION,
    'fc:frame:image': CONFIG.APP.URL + '/og-image.png',
    'fc:frame:image:aspect_ratio': CONFIG.FARCASTER.IMAGE_ASPECT_RATIO,
    'fc:frame:button:1': 'Send Tip',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': CONFIG.APP.URL,
    'og:title': CONFIG.APP.NAME,
    'og:description': CONFIG.APP.DESCRIPTION,
    'og:image': CONFIG.APP.URL + '/og-image.png'
  };

  // Add meta tags to head
  Object.entries(meta).forEach(([property, content]) => {
    const existing = document.querySelector(`meta[property="${property}"]`);
    
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      const metaTag = document.createElement('meta');
      metaTag.setAttribute('property', property);
      metaTag.setAttribute('content', content);
      document.head.appendChild(metaTag);
    }
  });
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
