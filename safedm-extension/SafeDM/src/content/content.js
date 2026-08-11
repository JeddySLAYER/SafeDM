// content/content.js

// HMR-START
import handleReload  from "./handleReload";
handleReload()
// HMR-END


console.log('Content script loaded on:', window.location.href);

// Listen for messages from background or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'showNotification') {
    showNotification(request.message);
    sendResponse({ success: true });
  }
  
  if (request.action === 'getPageInfo') {
    // Return page information
    sendResponse({
      title: document.title,
      url: window.location.href,
      textContent: document.body.innerText.substring(0, 500)
    });
  }
  
  if (request.action === 'highlightText') {
    highlightPageText(request.text);
    sendResponse({ success: true });
  }
});

// Function to show a notification on the page
function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Function to highlight text on page
function highlightPageText(searchText) {
  if (!searchText) return;
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  
  nodes.forEach(node => {
    const text = node.textContent;
    const index = text.toLowerCase().indexOf(searchText.toLowerCase());
    
    if (index >= 0) {
      const span = document.createElement('span');
      span.innerHTML = text.substring(0, index) +
        '<mark style="background: yellow; padding: 2px;">' +
        text.substring(index, index + searchText.length) +
        '</mark>' +
        text.substring(index + searchText.length);
      node.parentNode.replaceChild(span, node);
    }
  });
}

// Send message to background when page loads
chrome.runtime.sendMessage({
  action: 'pageLoaded',
  url: window.location.href
}).catch(() => {
  // Extension context may be invalid
});

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);