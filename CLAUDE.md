# 給 Claude 的維護規則

使用者：劉宇哲（臺北醫學大學實習醫學生），用繁體中文回覆。這是他自己做的值班工具，主要在手機上用。

## 正本在這個 repo，不在 artifact

- 改東西一律改 `site/`，不要直接用 edit_version 改線上 artifact。改了線上沒改 repo，下次發布就會被蓋掉。
- 開工前先確認線上版本跟 repo 一致：拿 `get_artifact` 回傳的 version 跟 `RELEASES.md` 最後一列比。不一致代表有人沒走流程直接改了線上：先用 `read_file`（paths）把線上檔案抓下來，跟 `site/` diff，把差異 commit 進來再開始改。

## 每次改動

1. 先寫測試重現問題（`tests/`），確定它在改之前會失敗
2. 改 `site/`
3. `python3 scripts/check.py && python3 -m pytest -q tests` 全部通過
4. `CHANGELOG.md` 的「## [未發布]」底下寫一行，分「修正」「新增」「變更」
5. commit（訊息用繁體中文，第一行寫做了什麼）

## 發布

1. `python3 scripts/release.py patch|minor|major`：會跑檢查和測試、改版本號、整理 CHANGELOG、commit、打 tag，並寫出 `dist/publish.json`
2. 用 `publish_files` 發布 `dist/publish.json` 裡的檔案到 slug `dd7bba5d-4f79-4d51-9ce8-bae6b37db5da`。這個 artifact 是 public，要帶 `shared_live: "public"` 和 `artifact_title: "臨床輔助決策工具"`；base_version 用 `RELEASES.md` 最後一列的版本。只改了幾個檔案的話，可以只列那幾個（patch 模式，其他檔案保留）
3. `python3 scripts/release.py record <publish 回傳的 version>`，然後 `git -c push.negotiate=false push`
   - Claude 的工作環境推不上 tag（會 403），不要一直重試：請使用者在 GitHub 的 Releases 頁面用同名 tag（vX.Y.Z）建立 release，目標選 release.py 印出的那個 commit

## 開工

工作環境不會保留。新對話先把 repo 接上（add_repo：YuZheLiu125/clinical-decision-tool），clone 下來，再 `pip install pytest playwright --break-system-packages && python3 -m playwright install chromium`

## 架構上要注意的地方（改之前先讀）

- **總站與工具同源**：總站 `index.html` 用 iframe 載入 `tools/*.html`，大家共用同一份 localStorage。工具之間靠 `storage` 事件和 `postMessage({hub: ...})` 溝通。
- **待辦表 `shiftboard.v1` 有很多寫入者**：主訴處理、會診稿、用藥速查透過內嵌的 `hubTodo`（三份一樣的程式，改一份要三份一起改），查房板則有自己的 `todoAdd`。每個寫入者都是先讀、改、再寫回整包。待辦表存檔前會先讀回別人新加的項目，靠 `gone` 記住自己刪掉的。
- **子項目一律用 id 對應**（`<待辦 id>.<k>`），不要用陣列位置。
- **雲端同步**（`index.html` 最後一段）：以 key 為單位、整包同步。雲端有新資料時，對每個 iframe 送一個合成的 `StorageEvent`。只有 `OWN` 表裡列的工具，在自己的 key 變了時才重新載入。新增會被其他裝置改到的 key 時，要確認對應的工具有聽 `storage` 事件，不然就加進 `OWN`。
- **只存本機的 key** 加在 `skip()`（目前是 `hub.sync.*` 和 `acls-run`）。
- **隱式狀態機**：各工具的狀態分散在旗標、陣列、CSS class 裡（例如待辦項目的已到時、已響過，查房板的 view／round／imp／send，主訴處理的 UI.view 和 step）。改動狀態時，要想清楚重新載入、雲端同步、其他工具同時寫入這三種情況。

## 臨床內容

藥物劑量、ACLS 流程、正常值改動時，要在 CHANGELOG 寫明根據（指引名稱與年份），並請使用者確認。
