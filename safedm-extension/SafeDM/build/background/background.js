


// Background service worker for Chrome Extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  
  console.log('Extension installed:', details.reason);
  
  // Initialize storage with default values
  chrome.storage.sync.set({
    count: 0,
    enabled: true
  });
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);
  
  if (request.action === 'getTabInfo') {
    // Get active tab information
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title,
          id: tabs[0].id
        });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'incrementCount') {
    // Increment counter in storage
    chrome.storage.sync.get(['count'], (result) => {
      const newCount = (result.count || 0) + 1;
      chrome.storage.sync.set({ count: newCount }, () => {
        sendResponse({ count: newCount });
      });
    });
    return true;
  }
  
  if (request.action === 'notify') {
    // Send notification to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: request.message
        }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
    });
    sendResponse({ success: true });
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('Tab loaded:', tab.url);
  }
});

// Handle keyboard shortcuts (if defined in manifest)
chrome.commands?.onCommand.addListener((command) => {
  console.log('Command received:', command);
});