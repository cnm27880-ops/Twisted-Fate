// ===== 繁簡切換（全站共用） =====
// 資料庫內容理論上都以繁體儲存，但條目可能是編輯時忘記轉換、直接貼上簡體文字存進去的，
// 不能保證每一筆都真的是繁體，甚至同一頁裡可能繁簡混雜。
// opencc-js 內建的 HTMLConverter 是「轉換一次、之後只能復原成原文」的單向設計：
// 若原文其實已經是簡體，切到「繁體」模式時 restore() 只會退回那段簡體原文，畫面完全沒變化。
// 這裡改成每次都用「目前顯示模式所需要的方向」直接正規化畫面上的文字：
// 顯示繁體用簡轉繁、顯示簡體用繁轉簡，不管文字原本是哪種字體，轉換後都會落在正確的目標字體，
// 前後多次切換也不會累積誤差（繁體/簡體字再轉一次同方向基本上是不動點）。
//
// 選擇的模式存在 localStorage，同一個瀏覽器切到任何一頁都是同一個設定，
// 不需要每頁各自再選一次。
const SCRIPT_MODE_KEY = "tf_script_mode_v1";

let scriptMode = localStorage.getItem(SCRIPT_MODE_KEY) === "simp" ? "simp" : "trad";
let toTradConverter = null, toSimpConverter = null;
const OPENCC_URL = "https://cdn.jsdelivr.net/npm/opencc-js@1.4.1/dist/esm/full.js";

function convertTextNodes(node, converter){
  if(node.nodeType === Node.ELEMENT_NODE){
    if(node.classList && node.classList.contains("ignore-opencc")) return; // .script-switch 開關本身文字不轉換
    const tag = node.tagName;
    if(tag === "SCRIPT" || tag === "STYLE") return;
    if(node.hasAttribute){
      if(node.hasAttribute("placeholder")) node.setAttribute("placeholder", converter(node.getAttribute("placeholder")));
      if(node.hasAttribute("title")) node.setAttribute("title", converter(node.getAttribute("title")));
      if(node.hasAttribute("aria-label")) node.setAttribute("aria-label", converter(node.getAttribute("aria-label")));
    }
    node.childNodes.forEach(child => convertTextNodes(child, converter));
  } else if(node.nodeType === Node.TEXT_NODE && node.nodeValue){
    const converted = converter(node.nodeValue);
    // 先比較再寫入：字體已經正確的文字維持原樣，避免無意義地觸發下面 MutationObserver 自己的變動事件。
    if(converted !== node.nodeValue) node.nodeValue = converted;
  }
}

function applyScriptMode(root){
  const converter = scriptMode === "simp" ? toSimpConverter : toTradConverter;
  if(converter) convertTextNodes(root || document.body, converter); // 辭典還沒到就先照原文顯示
  document.body.setAttribute("lang", scriptMode === "simp" ? "zh-CN" : "zh-TW");
  document.querySelectorAll(".script-switch button[data-mode]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-mode") === scriptMode);
  });
}

// 規則書、角色卡等頁面的內容大多是登入後才非同步從 Firebase 讀回來、動態插入畫面的，
// 不可能每個渲染函式都手動記得再呼叫一次 applyScriptMode()——用 MutationObserver
// 監看整個 <body>，只要有新內容插進來或文字被改掉，就自動用目前的模式轉換一次。
let observerStarted = false;
function startAutoConvert(){
  if(observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(mutations => {
    const converter = scriptMode === "simp" ? toSimpConverter : toTradConverter;
    if(!converter) return; // 辭典還沒載到，等 loadOpenCC() 完成後會自己補轉一次
    for(const m of mutations){
      if(m.type === "childList"){
        m.addedNodes.forEach(n => convertTextNodes(n, converter));
      } else if(m.type === "characterData" && m.target){
        convertTextNodes(m.target, converter);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

async function loadOpenCC(){
  try{
    // 也擋住「連得上但一直沒回應」的情況：逾時就當作載不到，
    // 否則切換鈕會一直可按卻沒有反應，使用者只會覺得壞掉。
    const OpenCC = (await Promise.race([
      import(OPENCC_URL),
      new Promise((_, rej) => setTimeout(() => rej(new Error("opencc timeout")), 8000))
    ])).default;
    toTradConverter = OpenCC.Converter({ from: "cn", to: "tw" });
    toSimpConverter = OpenCC.Converter({ from: "tw", to: "cn" });
    applyScriptMode(); // 辭典到了再把整頁轉一次
  }catch(e){
    console.warn("繁簡辭典載入失敗，改以資料庫原文顯示", e);
    document.querySelectorAll(".script-switch button[data-mode]").forEach(btn => {
      btn.disabled = true;
      btn.title = "繁簡辭典載入失敗（可能是網路或 CDN 問題），目前僅顯示資料庫原文";
    });
  }
}

function wireScriptSwitchButtons(){
  document.querySelectorAll(".script-switch button[data-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      if(mode === scriptMode) return;
      scriptMode = mode;
      localStorage.setItem(SCRIPT_MODE_KEY, scriptMode);
      applyScriptMode();
    });
  });
}

// 每一頁在 DOM 準備好、.script-switch 按鈕已經在畫面上之後呼叫一次即可。
export function initScriptMode(){
  wireScriptSwitchButtons();
  applyScriptMode();
  startAutoConvert();
  loadOpenCC();
}

export { applyScriptMode, getScriptMode };
function getScriptMode(){ return scriptMode; }
