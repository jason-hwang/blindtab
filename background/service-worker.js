// Notify content script when a tab navigates to a new URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Fire when URL changes (loading state) or page finishes loading
  if (changeInfo.status === 'loading' && changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      type: 'CHECK_URL',
      url: changeInfo.url
    }).catch(() => {
      // Content script may not be ready yet; it will self-check on injection
    });
  }
});
