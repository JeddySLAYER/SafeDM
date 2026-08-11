function l(){const o="localhost";let t,n;function i(){t=new WebSocket(`ws://${o}:8081/`),t.onopen=()=>{console.log("Connected to WebSocket"),n&&(clearTimeout(n),n=null)},t.onmessage=c=>{try{const s=JSON.parse(c.data);console.log(s),s.type==="reload"&&(console.log("Reloading page..."),window.location.reload())}catch{}},t.onerror=c=>{console.warn("WebSocket connection error:",c)},t.onclose=()=>{console.log("WebSocket disconnected, reconnecting in 3s..."),n=setTimeout(i,3e3)}}i()}l();console.log("Content script loaded on:",window.location.href);chrome.runtime.onMessage.addListener((e,o,a)=>{console.log("Content script received message:",e),e.action==="showNotification"&&(d(e.message),a({success:!0})),e.action==="getPageInfo"&&a({title:document.title,url:window.location.href,textContent:document.body.innerText.substring(0,500)}),e.action==="highlightText"&&(m(e.text),a({success:!0}))});function d(e){const o=document.createElement("div");o.textContent=e,o.style.cssText=`
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
  `,document.body.appendChild(o),setTimeout(()=>{o.style.animation="slideOut 0.3s ease-out",setTimeout(()=>o.remove(),300)},3e3)}function m(e){if(!e)return;const o=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,!1),a=[];for(;o.nextNode();)a.push(o.currentNode);a.forEach(t=>{const n=t.textContent,i=n.toLowerCase().indexOf(e.toLowerCase());if(i>=0){const c=document.createElement("span");c.innerHTML=n.substring(0,i)+'<mark style="background: yellow; padding: 2px;">'+n.substring(i,i+e.length)+"</mark>"+n.substring(i+e.length),t.parentNode.replaceChild(c,t)}})}chrome.runtime.sendMessage({action:"pageLoaded",url:window.location.href}).catch(()=>{});const r=document.createElement("style");r.textContent=`
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
`;document.head.appendChild(r);
