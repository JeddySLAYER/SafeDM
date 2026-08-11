// src/reload.js

export default function handleReload() {
  

  const protocol = "ws";
  const host = "localhost";
  const port =  8081;
  
  let ws;
  let reconnectTimeout;

  function connect() {
    ws = new WebSocket(`${protocol}://${host}:${port}/`);

    ws.onopen = () => {
      console.log("Connected to WebSocket");
      // Clear any reconnection timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
       
        
        if (data.type === "update") {
          // Handle hot module updates
          console.log("Update received");
          location.reload();
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket connection error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting in 3s...");
      // Attempt to reconnect after a delay
      reconnectTimeout = setTimeout(connect, 3000);
    };
  }

  connect();

  // Cleanup on unload
  self.addEventListener("unload", () => {
    if (ws) {
      ws.close();
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
  });
}


