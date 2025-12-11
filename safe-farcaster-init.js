// safe-farcaster-init.js
// Client-only helper to safely initialize Farcaster Miniapp SDK.
// CRITICAL: Call ready() IMMEDIATELY to dismiss splash screen

export async function ensureFarcasterReady({
  importTimeout = 5000,
  readyTimeout = 10000,
  pollInterval = 100
} = {}) {
  if (typeof window === 'undefined') return null;

  // Helper to race promise with timeout
  const promiseWithTimeout = (promise, ms) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('import timeout')), ms);
      promise.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
    });

  try {
    // Import SDK with timeout
    const mod = await promiseWithTimeout(import('@farcaster/miniapp-sdk'), importTimeout);
    const sdk = mod?.sdk || mod?.default || mod;

    if (!sdk || typeof sdk.actions !== 'object') {
      console.warn('Farcaster SDK loaded but no actions object found.');
      return null;
    }

    // CRITICAL: Call ready() IMMEDIATELY if available
    // Don't wait for any conditions - call it right away
    if (typeof sdk.actions.ready === 'function') {
      console.log('🎯 Calling sdk.actions.ready() immediately...');
      
      try {
        // Call ready without waiting - this dismisses the splash screen
        sdk.actions.ready();
        console.log('✅ Farcaster SDK ready() called successfully');
        
        // Return SDK immediately - don't wait
        return sdk;
      } catch (err) {
        console.warn('⚠️ sdk.actions.ready() threw error:', err);
        // Return SDK anyway - ready() was called even if it errored
        return sdk;
      }
    } else {
      // If ready() isn't available yet, poll for it but with short timeout
      console.log('⏳ Waiting for sdk.actions.ready to become available...');
      
      const waitFor = (fn, timeout, interval) =>
        new Promise(resolve => {
          const deadline = Date.now() + timeout;
          (function poll() {
            try { 
              if (fn()) {
                resolve(true);
                return;
              }
            } catch(e) {}
            if (Date.now() > deadline) {
              resolve(false);
              return;
            }
            setTimeout(poll, interval);
          })();
        });

      const ok = await waitFor(() => typeof sdk.actions.ready === 'function', readyTimeout, pollInterval);

      if (ok && typeof sdk.actions.ready === 'function') {
        try {
          sdk.actions.ready();
          console.log('✅ Farcaster SDK ready() called after polling');
        } catch (err) {
          console.warn('⚠️ sdk.actions.ready() threw after polling:', err);
        }
      } else {
        console.warn('⚠️ sdk.actions.ready not available within timeout');
      }
      
      return sdk;
    }
  } catch (err) {
    console.warn('Farcaster SDK import/ready failed:', err);
    return null;
  }
}

// Alternative: Call ready() synchronously if SDK is already loaded
export function callReadyIfAvailable() {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check if SDK is already in window
    const sdk = window.sdk || window.__FARCASTER_SDK__;
    
    if (sdk && typeof sdk.actions?.ready === 'function') {
      console.log('🎯 Calling ready() on existing SDK...');
      sdk.actions.ready();
      console.log('✅ Ready called on existing SDK');
      return true;
    }
  } catch (err) {
    console.warn('⚠️ Error calling ready on existing SDK:', err);
  }
  
  return false;
}
