function f(){const o="localhost";let r,a;function t(){r=new WebSocket(`ws://${o}:8081/`),r.onopen=()=>{console.log("Connected to WebSocket"),a&&(clearTimeout(a),a=null)},r.onmessage=c=>{try{const i=JSON.parse(c.data);console.log(i),i.type==="reload"&&(console.log("Reloading page..."),window.location.reload())}catch{}},r.onerror=c=>{console.warn("WebSocket connection error:",c)},r.onclose=()=>{console.log("WebSocket disconnected, reconnecting in 3s..."),a=setTimeout(t,3e3)}}t()}f();const n="safedm-gate-banner",l="safedm-gate-style",m={ALLOW:{bg:"#ecfdf3",border:"#027a48",text:"#027a48",accent:"#027a48"},WARN:{bg:"#fffaeb",border:"#b54708",text:"#b54708",accent:"#b54708"},BLOCK:{bg:"#fef3f2",border:"#b42318",text:"#b42318",accent:"#b42318"},PENDING:{bg:"#e8f1fc",border:"#1769d4",text:"#1257b0",accent:"#1769d4"}};function u(){if(document.getElementById(l))return;const e=document.createElement("style");e.id=l,e.textContent=`
    @keyframes safedm-slide-in {
      from { transform: translateY(-12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    #${n} {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483646;
      width: min(520px, calc(100vw - 24px));
      font-family: "Segoe UI", system-ui, sans-serif;
      animation: safedm-slide-in 0.25s ease-out;
      box-shadow: 0 8px 28px rgba(20, 24, 31, 0.18);
      border-radius: 10px;
      border: 1px solid;
      overflow: hidden;
    }
    #${n} .safedm-inner {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
      align-items: flex-start;
    }
    #${n} .safedm-mark {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    #${n} .safedm-body { flex: 1; min-width: 0; }
    #${n} .safedm-brand {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.75;
      margin: 0 0 4px;
    }
    #${n} .safedm-title {
      margin: 0;
      font-size: 15px;
      font-weight: 650;
      line-height: 1.3;
    }
    #${n} .safedm-meta {
      margin: 6px 0 0;
      font-size: 12px;
      opacity: 0.9;
      word-break: break-word;
    }
    #${n} .safedm-close {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 2px;
      opacity: 0.55;
      color: inherit;
    }
    #${n} .safedm-close:hover { opacity: 1; }
  `,(document.head||document.documentElement).appendChild(e)}function p(e){switch(e){case"ALLOW":return"OK";case"BLOCK":return"!";case"PENDING":return"…";default:return"?"}}function d(){document.getElementById(n)?.remove()}function b(e){u(),d();const o=(e?.decision||"WARN").toUpperCase(),s=m[o]||m.WARN,r=e?.risk_score!=null?`Score risque : ${e.risk_score}`:null,a=e?.summary||e?.headline_detail||e?.url||e?.domain||null,t=document.createElement("div");t.id=n,t.setAttribute("role","status"),t.style.background=s.bg,t.style.borderColor=s.border,t.style.color=s.text,t.innerHTML=`
    <div class="safedm-inner">
      <div class="safedm-mark" style="background:${s.accent}">${p(o)}</div>
      <div class="safedm-body">
        <p class="safedm-brand">SafeDM</p>
        <p class="safedm-title"></p>
        <p class="safedm-meta"></p>
      </div>
      <button type="button" class="safedm-close" aria-label="Fermer">×</button>
    </div>
  `,t.querySelector(".safedm-title").textContent=e?.headline||o;const c=t.querySelector(".safedm-meta"),i=[r,a].filter(Boolean);i.length?c.textContent=i.join(" · "):c.remove(),t.querySelector(".safedm-close").addEventListener("click",d),(document.body||document.documentElement).appendChild(t),o!=="PENDING"&&setTimeout(()=>{document.getElementById(n)===t&&d()},o==="BLOCK"?12e3:8e3)}chrome.runtime.onMessage.addListener((e,o,s)=>e?.action==="safedmShowResult"?(b(e.payload||{}),s({success:!0}),!0):!1);
