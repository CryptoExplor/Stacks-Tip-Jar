// src/safe-farcaster-init.js
// Client-only helper to safely initialize Farcaster Miniapp SDK.
// Returns sdk object if ready, else null.
// Usage: const sdk = await ensureFarcasterReady();

export async function ensureFarcasterReady({
  importTimeout = 5000,
  readyTimeout = 30000,
  pollInterval = 200
} = {}) {
  if (typeof window === 'undefined') return null;

  // dynamic import with timeout
  const promiseWithTimeout = (promise, ms) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('import timeout')), ms);
      promise.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
    });

  try {
    const mod = await promiseWithTimeout(import('@farcaster/miniapp-sdk'), importTimeout);
    const sdk = mod?.sdk || mod?.default || mod;

    if (!sdk || typeof sdk.actions !== 'object') {
      console.warn('Farcaster frame-sdk loaded but no actions object found.');
      return null;
    }

    // wait for actions.ready to exist
    const waitFor = (fn, timeout, interval) =>
      new Promise(resolve => {
        const deadline = Date.now() + timeout;
        (function poll() {
          try { if (fn()) return resolve(true); } catch(e) {}
          if (Date.now() > deadline) return resolve(false);
          setTimeout(poll, interval);
        })();
      });

    const ok = await waitFor(() => typeof sdk.actions.ready === 'function', readyTimeout, pollInterval);

    if (!ok) {
      console.warn('Farcaster sdk.actions.ready not available within timeout');
      return null;
    }

    try {
      await sdk.actions.ready();
      console.log('✅ Farcaster SDK ready');
      return sdk;
    } catch (err) {
      console.warn('sdk.actions.ready() threw:', err);
      return null;
    }
  } catch (err) {
    console.warn('Farcaster frame-sdk import/ready failed:', err);
    return null;
  }
}
