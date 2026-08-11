(()=>{console.log("Content script loaded on:",window.location.href);chrome.runtime.onMessage.addListener((t,e,o)=>{console.log("Content script received message:",t),t.action==="showNotification"&&(c(t.message),o({success:!0})),t.action==="getPageInfo"&&o({title:document.title,url:window.location.href,textContent:document.body.innerText.substring(0,500)}),t.action==="highlightText"&&(d(t.text),o({success:!0}))});function c(t){let e=document.createElement("div");e.textContent=t,e.style.cssText=`
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
  `,document.body.appendChild(e),setTimeout(()=>{e.style.animation="slideOut 0.3s ease-out",setTimeout(()=>e.remove(),300)},3e3)}function d(t){if(!t)return;let e=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,!1),o=[];for(;e.nextNode();)o.push(e.currentNode);o.forEach(a=>{let i=a.textContent,n=i.toLowerCase().indexOf(t.toLowerCase());if(n>=0){let s=document.createElement("span");s.innerHTML=i.substring(0,n)+'<mark style="background: yellow; padding: 2px;">'+i.substring(n,n+t.length)+"</mark>"+i.substring(n+t.length),a.parentNode.replaceChild(s,a)}})}chrome.runtime.sendMessage({action:"pageLoaded",url:window.location.href}).catch(()=>{});var r=document.createElement("style");r.textContent=`
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
`;document.head.appendChild(r);})();
