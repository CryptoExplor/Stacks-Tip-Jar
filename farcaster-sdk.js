// farcaster-sdk.js - Complete Farcaster Miniapp SDK initialization from scratch
// This MUST be the first script loaded in your app

let farcasterSDK = null;
let sdkInitialized = false;
let readyCalled = false;

// Initialize SDK immediately
async function initFarcasterSDK() {
  if (typeof window === 'undefined') {
    console.log('⚠️ Not in browser environment');
    return null;
  }

  // Check if already initialized
  if (sdkInitialized && farcasterSDK) {
    console.log('✅ SDK already initialized');
    return farcasterSDK;
  }

  try {
    console.log('🎯 Importing Farcaster SDK...');
    
    // Import the SDK
    const module = await import('@farcaster/miniapp-sdk');
    const sdk = module.sdk || module.default || module;
    
    if (!sdk) {
      console.warn('⚠️ SDK import failed - not in Farcaster');
      return null;
    }

    console.log('✅ SDK imported successfully');
    console.log('📦 SDK object:', sdk);
    console.log('🔧 SDK.actions:', sdk.actions);
    
    farcasterSDK = sdk;
    sdkInitialized = true;

    // Call ready() IMMEDIATELY - this is critical
    if (sdk.actions && typeof sdk.actions.ready === 'function') {
      if (!readyCalled) {
        console.log('🚀 Calling sdk.actions.ready()...');
        
        try {
          // Call ready - this dismisses the splash screen
          await sdk.actions.ready();
          readyCalled = true;
          console.log('✅ sdk.actions.ready() called successfully!');
        } catch (err) {
          console.error('❌ Error calling ready():', err);
          // Try calling without await as fallback
          try {
            sdk.actions.ready();
            readyCalled = true;
            console.log('✅ ready() called (sync fallback)');
          } catch (err2) {
            console.error('❌ Sync ready() also failed:', err2);
          }
        }
      } else {
        console.log('ℹ️ ready() already called');
      }
    } else {
      console.warn('⚠️ sdk.actions.ready is not available');
      console.log('Available methods:', Object.keys(sdk.actions || {}));
    }

    // Store SDK globally for access
    window.__FARCASTER_SDK__ = sdk;
    
    return sdk;
    
  } catch (error) {
    console.log('ℹ️ Not in Farcaster miniapp or SDK not available');
    console.log('Error:', error.message);
    return null;
  }
}

// Get SDK context (user info, etc)
async function getFarcasterContext() {
  if (!farcasterSDK) {
    console.warn('⚠️ SDK not initialized');
    return null;
  }

  try {
    console.log('📱 Getting Farcaster context...');
    
    // Add timeout to prevent hanging
    const contextPromise = farcasterSDK.context;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Context timeout')), 3000)
    );
    
    const context = await Promise.race([contextPromise, timeoutPromise]);
    
    if (context?.user) {
      console.log('✅ Got Farcaster context:', {
        username: context.user.username,
        fid: context.user.fid,
        displayName: context.user.displayName
      });
      return context;
    }
    
    return null;
  } catch (error) {
    console.log('ℹ️ Could not get Farcaster context:', error.message);
    return null;
  }
}

// Check if running in Farcaster
function isInFarcaster() {
  return sdkInitialized && farcasterSDK !== null;
}

// Get SDK instance
function getSDK() {
  return farcasterSDK;
}

// Manual ready call (for debugging)
function callReady() {
  if (!farcasterSDK?.actions?.ready) {
    console.error('❌ SDK or ready() not available');
    return false;
  }
  
  try {
    console.log('🔄 Manually calling ready()...');
    farcasterSDK.actions.ready();
    readyCalled = true;
    console.log('✅ Manual ready() succeeded');
    return true;
  } catch (err) {
    console.error('❌ Manual ready() failed:', err);
    return false;
  }
}

// Export functions
export {
  initFarcasterSDK,
  getFarcasterContext,
  isInFarcaster,
  getSDK,
  callReady
};

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  console.log('🎯 Auto-initializing Farcaster SDK...');
  initFarcasterSDK().then(sdk => {
    if (sdk) {
      console.log('✅ Farcaster SDK auto-initialized');
    } else {
      console.log('ℹ️ Not in Farcaster environment');
    }
  });
}
