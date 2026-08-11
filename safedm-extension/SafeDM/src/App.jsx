import { useState, useEffect } from 'react'

function App() {
  const [count, setCount] = useState(0);
  const [tabInfo, setTabInfo] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load initial data from storage
    chrome.storage.sync.get(['count', 'enabled'], (result) => {
      setCount(result.count || 0);
      setEnabled(result.enabled !== false);
    });

    // Get current tab info
    chrome.runtime.sendMessage({ action: 'getTabInfo' }, (response) => {
      if (response) {
        setTabInfo(response);
      }
    });
  }, []);

  const handleIncrement = () => {
    chrome.runtime.sendMessage({ action: 'incrementCount' }, (response) => {
      if (response) {
        setCount(response.count);
      }
    });
  };

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    chrome.storage.sync.set({ enabled: newEnabled });
  };

  const handleSendNotification = () => {
    if (message.trim()) {
      chrome.runtime.sendMessage({
        action: 'notify',
        message: message
      }, () => {
        setMessage('');
      });
    }
  };

  const handleHighlight = () => {
    if (tabInfo?.id) {
      chrome.tabs.sendMessage(tabInfo.id, {
        action: 'highlightText',
        text: 'sample'
      });
    }
  };

  return (
    <div className="w-96 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 shadow-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Chrome Extension</h1>
          <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full text-sm">
            <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-400 shadow-green-400 shadow-lg' : 'bg-red-400'}`}></span>
            <span>{enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4">
        {/* Counter Card */}
        <section className="bg-white rounded-xl p-4 shadow-md">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Counter</h2>
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 mb-3 text-center">
            <span className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {count}
            </span>
          </div>
          <button 
            onClick={handleIncrement}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            Increment Count
          </button>
        </section>

        {/* Current Tab Card */}
        <section className="bg-white rounded-xl p-4 shadow-md">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Current Tab</h2>
          {tabInfo ? (
            <div className="space-y-2">
              <p className="font-medium text-gray-800 text-sm">{tabInfo.title}</p>
              <p className="text-xs text-gray-500 break-all">{tabInfo.url}</p>
              <button 
                onClick={handleHighlight}
                className="w-full mt-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Highlight "sample" on page
              </button>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Loading...</p>
          )}
        </section>

        {/* Send Notification Card */}
        <section className="bg-white rounded-xl p-4 shadow-md">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Send Notification</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message..."
              className="flex-1 px-3 py-2 border-2 border-indigo-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && handleSendNotification()}
            />
            <button 
              onClick={handleSendNotification}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
            >
              Send
            </button>
          </div>
        </section>

        {/* Extension Settings Card */}
        <section className="bg-white rounded-xl p-4 shadow-md">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Extension Settings</h2>
          <div className="flex justify-between items-center">
            <span className="text-gray-700 text-sm font-medium">Extension Status</span>
            <button
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                enabled ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 p-3 text-center">
        <p className="text-xs text-gray-500">Sample Chrome Extension v1.0.0</p>
      </footer>
    </div>
  );
}

export default App