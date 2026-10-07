(()=>{var t="safedm-gate-banner",d="safedm-gate-style",c={ALLOW:{bg:"#ecfdf3",border:"#027a48",text:"#027a48",accent:"#027a48"},WARN:{bg:"#fffaeb",border:"#b54708",text:"#b54708",accent:"#b54708"},BLOCK:{bg:"#fef3f2",border:"#b42318",text:"#b42318",accent:"#b42318"},PENDING:{bg:"#e8f1fc",border:"#1769d4",text:"#1257b0",accent:"#1769d4"}};function f(){if(document.getElementById(d))return;let e=document.createElement("style");e.id=d,e.textContent=`
    @keyframes safedm-slide-in {
      from { transform: translateY(-12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    #${t} {
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
    #${t} .safedm-inner {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
      align-items: flex-start;
    }
    #${t} .safedm-mark {
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
    #${t} .safedm-body { flex: 1; min-width: 0; }
    #${t} .safedm-brand {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.75;
      margin: 0 0 4px;
    }
    #${t} .safedm-title {
      margin: 0;
      font-size: 15px;
      font-weight: 650;
      line-height: 1.3;
    }
    #${t} .safedm-meta {
      margin: 6px 0 0;
      font-size: 12px;
      opacity: 0.9;
      word-break: break-word;
    }
    #${t} .safedm-close {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 2px;
      opacity: 0.55;
      color: inherit;
    }
    #${t} .safedm-close:hover { opacity: 1; }
  `,(document.head||document.documentElement).appendChild(e)}function u(e){switch(e){case"ALLOW":return"OK";case"BLOCK":return"!";case"PENDING":return"\u2026";default:return"?"}}function a(){document.getElementById(t)?.remove()}function p(e){f(),a();let s=(e?.decision||"WARN").toUpperCase(),r=c[s]||c.WARN,l=e?.risk_score!=null?`Score risque : ${e.risk_score}`:null,m=e?.summary||e?.headline_detail||e?.url||e?.domain||null,n=document.createElement("div");n.id=t,n.setAttribute("role","status"),n.style.background=r.bg,n.style.borderColor=r.border,n.style.color=r.text,n.innerHTML=`
    <div class="safedm-inner">
      <div class="safedm-mark" style="background:${r.accent}">${u(s)}</div>
      <div class="safedm-body">
        <p class="safedm-brand">SafeDM</p>
        <p class="safedm-title"></p>
        <p class="safedm-meta"></p>
      </div>
      <button type="button" class="safedm-close" aria-label="Fermer">\xD7</button>
    </div>
  `,n.querySelector(".safedm-title").textContent=e?.headline||s;let o=n.querySelector(".safedm-meta"),i=[l,m].filter(Boolean);i.length?o.textContent=i.join(" \xB7 "):o.remove(),n.querySelector(".safedm-close").addEventListener("click",a),(document.body||document.documentElement).appendChild(n),s!=="PENDING"&&setTimeout(()=>{document.getElementById(t)===n&&a()},s==="BLOCK"?12e3:8e3)}chrome.runtime.onMessage.addListener((e,s,r)=>e?.action==="safedmShowResult"?(p(e.payload||{}),r({success:!0}),!0):!1);})();
