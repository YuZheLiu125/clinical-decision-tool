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
   - **Claude Code（桌面 App）也能發布**：用 Artifact 工具 publish，`url` 填 `https://claude.ai/artifact/dd7bba5d-4f79-4d51-9ce8-bae6b37db5da`、`file_path` 是 `site/index.html`、`files` 照 `dist/publish.json` 對到 `site/…`；不要帶 `capabilities`（保留線上的 db、user）。發布前先 `action: "read"` 確認線上版本 = `RELEASES.md` 最後一列。這是公開網頁，發布前要問使用者
4. 使用手冊在 `docs/guide/index.html`（簡報），發布到 `https://claude.ai/artifact/4246Z8nszEfYM84gL5PeF8`（Notion「臨床輔助決策工具」頁面的「簡易上手引導」連到這裡）。功能有使用者看得到的改變時，一起更新這份

## 開工

- Claude Code（使用者自己的電腦）：`pip install pytest playwright && python3 -m playwright install chromium`，需要 Node
- claude.ai 雲端工作環境（不會保留）：先 add_repo `YuZheLiu125/clinical-decision-tool` 並 clone，再 `pip install pytest playwright --break-system-packages && python3 -m playwright install chromium`
- 開工先跑一次 `python3 scripts/check.py && python3 -m pytest -q tests`，確定起點是綠的

## 交班（2026-11-12，v1.3.1）

**現況**：線上 artifact `1794494973-f037` = repo v1.3.1（commit 3f70cbd；修同步打斷工具載入、Android 相機選項，等使用者在 Android Chrome／Claude App 實測「📷 掃 QR」）；使用手冊 artifact `1794463981-845e` = `docs/guide/index.html`。46 項測試全過。v1.2.0 沒有單獨發布過，內容包含在 v1.3.0 裡。

**等使用者回饋**
- 累積報告解析用的是猜的 HIS 格式：使用者第一次實際貼的時候，請他把去識別化的畫面貼來對
- admission note 跨裝置同步只用假的雲端測過

**已知限制（使用者知道，可以接著做）**
- 查房板 `rounds.v1` 衝突時用雲端版本，本機那份備份在 `hub.sync.bak:rounds.v1`，但沒有介面可以還原。可以在查房板「⋯」加一個「還原同步前的版本」
- 雲端同步只用假的雲端（tests/conftest.py 的 MOCK_CLOUD）測過，兩台真實裝置的情境還沒實測
- 主訴處理進行中的 call 存在 sessionStorage：不上雲端，iOS 把分頁殺掉就沒了（admission note 已改存 `oncall.admit.v1`，會同步）
- 查房板匯入只分血液／尿液；胸水、腹水、CSF 等其他體液還沒有獨立的檢體，會被當成血液。累積報告解析是依常見格式猜的，還沒拿真實的 HIS 畫面驗證
- 尿液項目沒有正常範圍（刻意不標）
- `hubTodo` 有三份一樣的程式（consult／copilot／meds），抽成共用檔案能少一個出錯的地方，但每個工具要能單獨打開，所以要注意載入方式

**下一步建議**（依價值排序，動手前先問使用者要做哪個）
1. ~~待辦表 tombstone~~（已做，未發布版）
2. 查房板加還原同步前版本的按鈕
3. 把隱式狀態機明確化：先從待辦項目做（pending → overdue → alerted → snoozed／done），寫成一張狀態轉換表加測試

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
