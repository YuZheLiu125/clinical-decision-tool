# 臨床輔助決策工具

值班用的工具總站，作者劉宇哲。一個頁面裡有七個工具：ACLS、主訴處理、會診電話稿、值班用藥速查、檢驗正常值、查房板，以及常駐在旁邊的待辦表。
線上版本放在 claude.ai artifact（`dd7bba5d-4f79-4d51-9ce8-bae6b37db5da`），這個 repo 是**唯一正本**。

## 目錄

```
site/                 要發布的檔案（跟 artifact 裡的路徑一模一樣）
  index.html          總站：分頁、待辦抽屜、雲端同步
  tools/*.html        各工具，各自是完整的 HTML，用 iframe 嵌進總站
  tools/tess/         查房板 OCR 用的辨識資料
tests/                Playwright 瀏覽器測試
scripts/check.py      靜態檢查（語法、檔案、版本號）
scripts/release.py    發布：檢查 → 測試 → 版本號 → CHANGELOG → commit + tag
VERSION               目前版本號
CHANGELOG.md          每版改了什麼
RELEASES.md           git 版本 ↔ artifact 版本對照
CLAUDE.md             給 Claude 的維護規則
```

## 改東西的流程

1. 改 `site/` 裡的檔案
2. 這次修的 bug 或加的功能，**先寫一個會失敗的測試**，改完確定它會過
3. `python3 scripts/check.py && python3 -m pytest -q tests`
4. 在 `CHANGELOG.md` 的「未發布」底下寫一行改了什麼，然後 commit
5. 要上線時：`python3 scripts/release.py patch`（或 `minor`、`major`）
6. 用 Claude 把 `dist/publish.json` 列的檔案發布到 artifact，再跑 `python3 scripts/release.py record <artifact 版本>`

## 第一次在新電腦上跑測試

```
pip install pytest playwright
python3 -m playwright install chromium
python3 -m pytest -q tests
```

需要 Node（`scripts/check.py` 用 `node --check` 檢查語法）。

## 資料存在哪裡

| localStorage key | 誰寫 | 內容 | 上雲端 |
|---|---|---|---|
| `shiftboard.v1` | 待辦表、主訴處理、會診稿、用藥速查、查房板 | 待辦（items／done） | ✓（衝突時逐項合併） |
| `rounds.v1` | 查房板 | 每床資料 | ✓（衝突時用雲端的，本機留 `hub.sync.bak:rounds.v1`） |
| `hub.lastBed`、`hub.todoPick`、`hub.pane` | 共用 | 最近床號、待辦預設、目前分頁 | ✓ |
| `acls-run` | ACLS | 急救進行中的狀態 | ✗ 只存本機 |
| `acls-tab`、`acls-scen`、`acls-dx-set` | ACLS | 介面偏好 | ✓（不會觸發重載） |
| `consult-draft`、`consult-example` | 會診稿 | 草稿 | ✓ |
| `wr3` | 用藥速查 | 目前主題、病人條件 | ✓ |
| `oncall.prefs.v1` | 主訴處理 | 偏好（UpToDate 網址） | ✓ |
| sessionStorage `oncall.draft.v1` | 主訴處理 | 進行中的 call、admission note | ✗ |
| IndexedDB `rounds-snap` | 查房板 | 自動快照（3 天、50 份） | ✗ |
| `hub.sync.*` | 總站 | 同步的時間戳、指紋、衝突備份 | ✗ |
