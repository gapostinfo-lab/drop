// Message handler MUST be at the very top (before any imports/async code)
// This prevents the browser warning about late message handler registration
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// OneSignal SDK import
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
