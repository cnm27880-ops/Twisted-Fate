# 逆命 (Twisted Fate) TRPG 網站 — 專案導覽

給 Claude 的速查表：**改網站前先讀這份，再用 Grep 定位函式，只 Read 需要的行段，不要整檔讀取**
（`dm.html` 約 3500 行、`character.html` 約 2400 行，整檔讀入非常耗 token）。

## 技術與部署
- 純靜態網站：每頁一個獨立 `.html`，CSS / JS 全部內嵌，沒有打包、沒有 build、沒有 npm 依賴。
- 後端：Firebase Realtime Database + 匿名登入（SDK 10.12.2，從 gstatic CDN 以 ES module 載入）。
- 身分：Discord OAuth（前端 token 流程）；權限存在 DB `admins/{discordId}` = `{role:"DM"|"Elder", name}`。
  - `DM`＝天道（最高權限）、`Elder`＝長老（可編修，不可管權限／排序／刪角色卡）。
- 繁簡切換：所有頁面共用 `script-mode.js`（opencc-js CDN），資料以繁體存。
- 使用者是程式新手，**回覆請用繁體中文、步驟詳細**；專業術語首次出現附英文。
- 沒有測試框架。改完 JS 後用下列指令做語法檢查（把頁面最大的 `<script type="module">` 抽出來 `node --check`）。

## 檔案地圖
| 檔案 | 用途 | 主要 DB 路徑 |
|---|---|---|
| `index.html` | 規則書閱讀頁（側邊目錄＋條目內容） | `chapters`, `modules` |
| `admin.html` | 規則書後台（編輯章節／條目） | `chapters`, `modules`, `logs` |
| `library.html` | 藏經閣（功法／典籍庫） | `library`, `chapters`, `modules`, `characters`, `admins` |
| `character.html` | 玩家角色卡（建立／編輯／刪除自己的卡、申請領物） | `characters`, `itemRequests`, 唯讀氏族資料 |
| `dm.html` | **宗門大殿**（DM／長老管理頁，最大的檔案） | 見下方 |
| `qi-validator.html` / `compare-helper.html` / `en-reference-import.html` | 後台小工具（靈氣檢查、中英比對、英文對照匯入） | `modules`, `chapters`, `en*` |
| `seed-data.js` | `dm.html` 用的預設資料 export：`ROSTER_SEED`, `WAREHOUSE_SEED`, `FACILITY_SEED`, `BEAST_SEED`, `SECT_PROFILE_SEED`, `QUEST_SEED` | — |
| `script-mode.js` | 全站繁簡切換 | localStorage `tf_script_mode_v1` |
| `scripts/` | 一次性 node 工具（英文原文切段） | — |

## dm.html 結構（用 Grep 找函式名即可）
- 全域狀態 `let admins/warehouse/stones/logs/roster/treasury/chars/itemRequests/tabletOrder/facilities/beasts/sectProfile/sectQuests`。
- 資料訂閱：`subscribeAllData()`（`watch` 必要資料、`watchOptional` 可選資料，後者規則未放行也不會卡死頁面）。
- 讀寫：`dref(path)` 會自動切換**沙盒路徑**（`sandbox/{ownerId}/...`），**寫 DB 一律用 `writeNow(path, value)`（value=null 即刪除）或 `scheduleSave`，不要直接 `set(ref(db,...))`**，否則沙盒會失效。
- 權限判斷：`canEdit()`（DM 或 Elder）、`isDM()`。
- 渲染：`renderAll(force)` 組出分頁；各分頁一個 `xxxHtml()` 函式回傳字串：
  `facilitiesHtml`(宗門設施) / `warehouseHtml`(庫房) / `treasuryHtml`(多寶閣) / `rosterHtml`(花名冊) / `reportHtml`(天機閣) / `combatHtml`(本命玉牌殿) / `questsHtml`(任務石碑) / `requestsHtml`(待批核卷宗) / `adminHtml`(權限管理)。
- 事件：全部集中在 `wireEvents(area)` — `[data-action]` 按鈕依 `action` 名稱分支；`if(!canEdit()) return;` 之後的分支需要編修權限；之前的分支（如 `del-char`、`tablet-move`）各自檢查 `isDM()`。
- 欄位即時編修用 `data-r`（花名冊）、`data-t`（多寶閣）、`data-w`（庫房）、`data-q-prop`（任務石碑）。
- 新增分頁步驟：①`renderAll` 的 `.tabs` 加按鈕 ②加 `<div class="tab-panel" id="tab-xxx">` ③寫 `xxxHtml()` ④（若有新 DB 路徑）`subscribeAllData` 加 `watchOptional`、`SANDBOX_CLONE_PATHS` 加路徑。
- 新增預設資料：寫進 `seed-data.js` 並在 `dm.html` 開頭的 `import` 補上名稱。

## 任務石碑（dm.html）
- DB 路徑 `sectQuests` = `{ sections:[{ title, items:[{ text, done, note }] }], updatedAt, updatedBy }`。
- DB 沒資料時顯示 `seed-data.js` 的 `QUEST_SEED`；一經天道／長老編修就整份寫入 DB，之後以 DB 為準。
- 所有人可看，只有 `canEdit()` 的人看到編輯介面。`saveQuests()` 是整份覆寫（兩人同時編修，後存者覆蓋）。

## 刪除角色卡
- 玩家：`character.html` 只能刪自己的卡（`char.ownerId === discordUser.id`）。
- 天道：`dm.html` 本命玉牌殿，每張玉牌右上有紅色 ✕（`data-action="del-char"`，僅 `isDM()`）。
  除了刪 `characters/{id}`，還會清掉 `tabletOrder` 內的 id 與該角色的 `itemRequests`（否則殘留卷宗會永遠批不了）。

## 慣例與注意
- 註解、UI 文字一律繁體中文；沿用現有風格（金／朱紅／玉色變數在各頁 `:root`）。
- 使用者輸入進 HTML 前一律 `escapeHtml()`（屬性用 `attr()`）。
- Firebase 陣列有空洞會被還原成物件，讀取時用 `toList()` / `readItemsList()` 之類轉回陣列。
- 新增 DB 路徑若 Firebase Rules 沒放行會寫入失敗 → 告知使用者去 Firebase Console 的 Rules 補。
- 開發分支：`claude/elegant-archimedes-nmd0g0`；PR 開 draft。

## 語法檢查指令（改完 dm.html 必跑）
```
python3 - <<'PY'
import re
s=open('dm.html',encoding='utf-8').read()
open('/tmp/dm_check.mjs','w').write(max(re.findall(r'<script type="module">(.*?)</script>',s,re.S),key=len))
PY
node --check /tmp/dm_check.mjs && echo OK
```
