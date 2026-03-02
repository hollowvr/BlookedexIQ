//handles user installing the extension or an extension update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({ firstInstall: true });

    chrome.tabs.create({
      url: "https://dashboard.blooket.com/market",
    });
  } else if (details.reason === "update") {
    const thisVersion = chrome.runtime.getManifest().version;
    console.log(`Updated from ${details.previousVersion} to ${thisVersion}!`);
    // Show an update message to the user
  }
});
