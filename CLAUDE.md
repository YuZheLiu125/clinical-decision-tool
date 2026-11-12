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
   - 推 tag：`git push --tags`。在 claude.ai 的雲端工作環境推 tag 會 403，不要重試，請使用者在 GitHub Releases 頁面用同名 tag 建立 release
   - **Claude Code 沒有 claude.ai 的 Artifact 工具**：在 Claude Code 裡做到步驟 1 和 push 為止，把「要發布 vX.Y.Z」告訴使用者，由他在 claude.ai 開對話說「發布臨床輔助決策工具 vX.Y.Z」。那邊的 Claude 會 clone repo、照 dist/publish.json 發布，再跑 record 並 push

## 開工

- Claude Code（使用者自己的電腦）：`pip install pytest playwright && python3 -m playwright install chromium`，需要 Node
- claude.ai 雲端工作環境（不會保留）：先 add_repo `YuZheLiu125/clinical-decision-tool` 並 clone，再 `pip install pytest playwright --break-system-packages && python3 -m playwright install chromium`
- 開工先跑一次 `python3 scripts/check.py && python3 -m pytest -q tests`，確定起點是綠的

## 交班（2026-11-12，v1.1.0）

**現況**：線上 artifact `1794400593-d511` = repo v1.1.0（commit 434ac7c）。27 項測試全過。

**還沒做完**
- [x] tag `v1.0.0`（8b068e5）、`v1.1.0`（434ac7c）在本機 bundle 有，GitHub 上還沒有。在 Claude Code 可以直接補：`git tag -a v1.0.0 8b068e5 -m v1.0.0 && git tag -a v1.1.0 434ac7c -m v1.1.0 && git push --tags`（2026-11-12 已補）

**已知限制（使用者知道，可以接著做）**
- 查房板 `rounds.v1` 衝突時用雲端版本，本機那份備份在 `hub.sync.bak:rounds.v1`，但沒有介面可以還原。可以在查房板「⋯」加一個「還原同步前的版本」
- 雲端同步只用假的雲端（tests/conftest.py 的 MOCK_CLOUD）測過，兩台真實裝置的情境還沒實測
- 主訴處理進行中的 call 存在 sessionStorage：不上雲端，iOS 把分頁殺掉就沒了
- `hubTodo` 有三份一樣的程式（consult／copilot／meds），抽成共用檔案能少一個出錯的地方，但每個工具要能單獨打開，所以要注意載入方式

**下一步建議**（依價值排序，動手前先問使用者要做哪個）
1. ~~待辦表 tombstone~~（已做，未發布版）
2. 查房板加還原同步前版本的按鈕
3. 把隱式狀態機明確化：先從待辦項目做（pending → overdue → alerted → snoozed／done），寫成一張狀態轉換表加測試

## 架構上要注意的地方（改之前先讀）

- **總站與工具同源**：總站 `index.html` 用 iframe 載入 `tools/*.html`，大家共用同一份 localStorage。工具之間靠 `storage` 事件和 `postMessage({hub: ...})` 溝通。
- **待辦表 `shiftboard.v1` 有很多寫入者**：主訴處理、會診稿、用藥速查透過內嵌的 `hubTodo`（三份一樣的程式，改一份要三份一起改），查房板則有自己的 `todoAdd`。每個寫入者都是先讀、改、再寫回整包。待辦表存檔前會先讀回別人新加的項目，靠 `gone` 記住自己刪掉的。
- **待辦表的刪除紀錄 `del`**（id → 刪除時間，14 天後清掉）：從待辦表移除項目（不是移到已完成）的地方都要寫進 `del`，雲端合併（`index.html` 的 `merge`）才知道那是刪的。目前寫入的地方：待辦表 `save()`（由 `gone` 轉入）、總站「撤銷」、查房板每日追蹤點換新和刪 problem。查房板「從這台電腦刪除這床」故意不寫（只在未同步的電腦上能用）。
- **子項目一律用 id 對應**（`<待辦 id>.<k>`），不要用陣列位置。
- **雲端同步**（`index.html` 最後一段）：以 key 為單位、整包同步。雲端有新資料時，對每個 iframe 送一個合成的 `StorageEvent`。只有 `OWN` 表裡列的工具，在自己的 key 變了時才重新載入。新增會被其他裝置改到的 key 時，要確認對應的工具有聽 `storage` 事件，不然就加進 `OWN`。
- **只存本機的 key** 加在 `skip()`（目前是 `hub.sync.*` 和 `acls-run`）。
- **隱式狀態機**：各工具的狀態分散在旗標、陣列、CSS class 裡（例如待辦項目的已到時、已響過，查房板的 view／round／imp／send，主訴處理的 UI.view 和 step）。改動狀態時，要想清楚重新載入、雲端同步、其他工具同時寫入這三種情況。

## 臨床內容

藥物劑量、ACLS 流程、正常值改動時，要在 CHANGELOG 寫明根據（指引名稱與年份），並請使用者確認。
