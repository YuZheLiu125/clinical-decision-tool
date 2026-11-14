# 給 Claude 的維護規則

使用者：劉宇哲（臺北醫學大學實習醫學生），用繁體中文回覆。這是他自己做的值班工具，主要在手機上用。

## 正本在這個 repo，不在 artifact

- 改東西一律改 `site/`，不要直接用 edit_version 改線上 artifact。改了線上沒改 repo，下次發布就會被蓋掉。
- 開工前先確認線上版本跟 repo 一致：拿 `get_artifact` 回傳的 version 跟 `RELEASES.md` 最後一列比。不一致代表有人沒走流程直接改了線上：先用 `read_file`（paths）把線上檔案抓下來，跟 `site/` diff，把差異 commit 進來再開始改。

## 每次改動

1. 先寫測試重現問題（`tests/`），確定它在改之前會失敗
2. 改 `site/`（共用樣式改 `shared/hub-common.css` 再跑 `python3 scripts/sync_shared.py`）
3. `python3 scripts/check.py && python3 -m pytest -q tests` 全部通過
4. `CHANGELOG.md` 的「## [未發布]」底下寫一行，分「修正」「新增」「變更」
5. commit（訊息用繁體中文，第一行寫做了什麼）

## 發布

1. `python3 scripts/release.py patch|minor|major`：會跑檢查和測試、改版本號、整理 CHANGELOG、commit、打 tag，並寫出 `dist/publish.json`
2. 用 `publish_files` 發布 `dist/publish.json` 裡的檔案到 slug `dd7bba5d-4f79-4d51-9ce8-bae6b37db5da`。這個 artifact 是 public，要帶 `shared_live: "public"` 和 `artifact_title: "臨床輔助決策工具"`；base_version 用 `RELEASES.md` 最後一列的版本。只改了幾個檔案的話，可以只列那幾個（patch 模式，其他檔案保留）
3. `python3 scripts/release.py record <publish 回傳的 version>`，然後 `git -c push.negotiate=false push`
   - 推 tag：`git push --tags`。在 claude.ai 的雲端工作環境推 tag 會 403，不要重試，請使用者在 GitHub Releases 頁面用同名 tag 建立 release
   - **Claude Code（桌面 App）也能發布**：用 Artifact 工具 publish，`url` 填 `https://claude.ai/artifact/dd7bba5d-4f79-4d51-9ce8-bae6b37db5da`、`file_path` 是 `site/index.html`、`files` 照 `dist/publish.json` 對到 `site/…`；不要帶 `capabilities`（保留線上的 db、user）。發布前先 `action: "read"` 確認線上版本 = `RELEASES.md` 最後一列。這是公開網頁，發布前要問使用者
4. 使用手冊在 `docs/guide/index.html`（簡報），發布到 `https://claude.ai/artifact/4246Z8nszEfYM84gL5PeF8`（Notion「臨床輔助決策工具」頁面的「簡易上手引導」連到這裡）。功能有使用者看得到的改變時，一起更新這份

## 開工

- Claude Code（使用者自己的電腦）：`pip install pytest playwright && python3 -m playwright install chromium`，需要 Node
- claude.ai 雲端工作環境（不會保留）：先 add_repo `YuZheLiu125/clinical-decision-tool` 並 clone，再 `pip install pytest playwright --break-system-packages && python3 -m playwright install chromium`
- 開工先跑一次 `python3 scripts/check.py && python3 -m pytest -q tests`，確定起點是綠的（約 4 分鐘）

## 交班（2026-11-14，v2 重塑，分支 `v2-redesign`，還沒發布）

**現況**：線上 artifact 仍是 `1794496654-a425` = v1.3.2（`main`）。`v2-redesign` 分支是整體設計重塑＋總站導覽重做＋接新病人新流程，75 項測試全過，另由獨立 subagent 檢核過一輪並修完。**還沒合併、還沒發布**：要先問使用者。發布時用 `release.py minor`（→ v1.4.0；資料格式相容，不是 major），使用手冊 `docs/guide/index.html` 也改了，要一起發布。給更新 Agent 的總覽文件在 Notion：https://app.notion.com/p/418b4a3589698152938cf5e3723bed9c

**等使用者回饋**
- 接新病人的欄位來源分類（`copilot.html` 的 `FSRC`／`CONFIRM`／`PRE_SECS`）是 Claude 預設的，要請使用者對照萬芳護理紀錄確認哪些其實查不到／查得到
- 關鍵資訊檢核 12 項（`KEYQ`）、「先想好三件事」的文字，請使用者看過
- 新版面在 iPhone 主畫面 App、Android 實機（Chrome 與 Claude App）都還沒實測；Android 只用模擬的 Pixel 7 測過。artifact 沙盒裡的返回鍵行為、下拉重新整理有沒有被擋住，要實機才知道
- 手機底部預設釘選是主訴處理、接新病人、查房板，使用者可能想換
- v1.3.2 留下來的：累積報告解析要真實 HIS 畫面來對；iPhone 主畫面 App 工具載不出來的問題有沒有再發生

**已知限制**
- 接新病人兩台同時改：整份後寫者贏（沒有欄位層級合併）。要做的話在 `applyRemoteAdmit` 合併：`f` 逐 key、`w.kq` 聯集、`w.tl`／`w.myq` 給 id
- 手機橫放（寬度 >900px）會變成電腦版面，可用但擠
- `#railList` 的 ARIA 角色不嚴謹（tablist 裡混了分組標題和待辦開關）；焦點在工具 iframe 裡時 Esc 關不了浮層
- ACLS 深色模式 `.step.s .n` 白字配淺紅底，對比不足（舊問題）
- 以下沿用 v1.3.2：查房板 `rounds.v1` 衝突備份沒有還原介面；雲端同步只用假的雲端測過；主訴處理進行中的 call 存在 sessionStorage；查房板匯入只分血液／尿液；`hubTodo` 有三份一樣的程式

**下一步建議**（動手前先問使用者）
1. 依使用者對欄位來源的回饋調整 `FSRC`
2. 接新病人欄位層級合併
3. 各工具內部還留著舊的膠囊形按鈕（999px 圓角），可以逐個工具收斂成 `--hub-r`
4. 查房板加還原同步前版本的按鈕

## v2 之後的做法（改之前先讀）

- **共用樣式**：正本是 `shared/hub-common.css`，改完跑 `python3 scripts/sync_shared.py`。不要改 HTML 裡 `/*hub-common:start*/…/*hub-common:end*/` 之間的內容（`check.py` 會擋）。標記後面是各工具自己的對應層，可以改
- **設計原則**：顏色只表達臨床意義（紅／琥珀／綠）；介面只有一個品牌色 `--hub-brand`。`--hub-pilot`／`--hub-meds`… 這些舊名字現在全部指到品牌色，不要再給工具各自的顏色。圖示用線條 SVG，不用 emoji
- **加工具**：`site/index.html` 的 `TOOLS` 加一行（說明在那段註解）。導覽、iframe、手機「全部工具」都由它產生。工具裡的畫面要有自己的導覽入口，用 `pane`＋`view`（例子：`admit`），工具端聽 `{hub:'go', view}`、回報 `{hub:'view', view}`
- **只屬於這台裝置的設定**用 `hub.ui.` 開頭（不上雲端）：`hub.ui.pins`、`hub.ui.rail`、`hub.ui.side`、`hub.ui.recent`
- **總站浮層**（待辦抽屜、全部工具）開啟時會 `history.pushState`，讓 Android 返回鍵先關浮層。新增浮層要走 `histPush`／`histPop`
- **重載工具 iframe 前要拿掉 pane 的 `loaded` class**，這樣 `whenLoaded` 排的訊息才會等新文件載完
- **本機預覽**：`cdt-site` 用 `scripts/serve.py`（不快取）。只改網址的 `#` 不會重新載入頁面

## 架構上要注意的地方（改之前先讀）

- **總站與工具同源**：總站 `index.html` 用 iframe 載入 `tools/*.html`，大家共用同一份 localStorage。工具之間靠 `storage` 事件和 `postMessage({hub: ...})` 溝通。
- **待辦表 `shiftboard.v1` 有很多寫入者**：主訴處理、會診稿、用藥速查透過內嵌的 `hubTodo`（三份一樣的程式，改一份要三份一起改），查房板則有自己的 `todoAdd`。每個寫入者都是先讀、改、再寫回整包。待辦表存檔前會先讀回別人新加的項目，靠 `gone` 記住自己刪掉的。
- **待辦表的刪除紀錄 `del`**（id → 刪除時間，14 天後清掉）：從待辦表移除項目（不是移到已完成）的地方都要寫進 `del`，雲端合併（`index.html` 的 `merge`）才知道那是刪的。目前寫入的地方：待辦表 `save()`（由 `gone` 轉入）、總站「撤銷」、查房板每日追蹤點換新和刪 problem。查房板「從這台電腦刪除這床」故意不寫（只在未同步的電腦上能用）。
- **追蹤點進待辦**：有日期的（非每日）一新增就送進待辦（`due` = 那天 08:00）；沒有日期的（範本的「出院前」）不送。刪追蹤點會刪它還沒完成的待辦並寫 `del`
- **檢驗 id**：血液用 `LABS` 的 id（Na、K…），尿液用 `U-` 開頭（`U-Na`）或 `UPCR`、`UACR`，在 `ULABS`；`URINE_OF`／`BLOOD_OF` 是同名項目的對照。`parseLabs(text, spec)` 的 spec 是 auto／B／U；`parseHistory` 回傳 `{days:[{d, vals, on}], skipped}`
- **子項目一律用 id 對應**（`<待辦 id>.<k>`），不要用陣列位置。
- **雲端同步**（`index.html` 最後一段）：以 key 為單位、整包同步。雲端有新資料時，對每個 iframe 送一個合成的 `StorageEvent`。只有 `OWN` 表裡列的工具，在自己的 key 變了時才重新載入。新增會被其他裝置改到的 key 時，要確認對應的工具有聽 `storage` 事件，不然就加進 `OWN`。
- **只存本機的 key** 加在 `skip()`（目前是 `hub.sync.*` 和 `acls-run`）。
- **隱式狀態機**：各工具的狀態分散在旗標、陣列、CSS class 裡（例如待辦項目的已到時、已響過，查房板的 view／round／imp／send，主訴處理的 UI.view 和 step）。改動狀態時，要想清楚重新載入、雲端同步、其他工具同時寫入這三種情況。

## 臨床內容

藥物劑量、ACLS 流程、正常值改動時，要在 CHANGELOG 寫明根據（指引名稱與年份），並請使用者確認。
