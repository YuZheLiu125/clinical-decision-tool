"""v2：總站導覽（依工具清單產生）、Android、接新病人的先查病歷／整理思緒／床邊檢核／複製給 AI。"""
import json

PILOT = "document.getElementById('f-pilot').contentWindow"


def selected(pg):
    return pg.evaluate("[...document.querySelectorAll('[aria-selected=\"true\"]')].map(b => b.id)")


# ── 總站 ──

def test_nav_is_generated_from_tool_list(page, base_url):
    page.goto(base_url + 'index.html')
    page.wait_for_timeout(600)
    ids = page.evaluate("[...document.querySelectorAll('#railList [data-go]')].map(b => b.dataset.go)")
    assert ids == ['acls', 'pilot', 'admit', 'rounds', 'consult', 'meds', 'labs']
    assert page.evaluate("[...document.querySelectorAll('#railList .grp')].map(g => g.textContent)") == ['急性處置', '病人', '溝通', '查詢', '值班']
    page.click('#tab-labs')
    assert 'tab-labs' in selected(page)
    assert page.evaluate("getComputedStyle(document.getElementById('pane-labs')).display") == 'flex'
    assert page.evaluate("getComputedStyle(document.getElementById('pane-meds')).display") == 'none'
    assert page.errors == []


def test_admit_entry_opens_admission_view_inside_pilot(page, base_url):
    page.goto(base_url + 'index.html')
    page.click('#tab-admit')
    page.wait_for_timeout(1500)
    assert page.evaluate(f"{PILOT}.eval('UI.view')") == 'admit'
    assert 'tab-admit' in selected(page) and 'tab-pilot' not in selected(page)
    # 還沒有 note：先給選擇畫面，不會自己建一份空的同步出去
    assert page.evaluate("localStorage.getItem('oncall.admit.v1')") is None
    page.click('#tab-pilot')
    page.wait_for_timeout(400)
    assert page.evaluate(f"{PILOT}.eval('UI.view')") == 'home'
    assert 'tab-pilot' in selected(page) and 'tab-admit' not in selected(page)
    # 在主訴處理裡自己點「接新病人」，導覽的亮燈也要跟著換
    page.frame_locator('#f-pilot').locator('[data-act="admit-new"]').click()
    page.wait_for_timeout(400)
    assert 'tab-admit' in selected(page)
    assert page.errors == []


def test_admit_deep_link(page, base_url):
    page.goto(base_url + 'index.html#admit')
    page.wait_for_timeout(1500)
    assert page.evaluate(f"{PILOT}.eval('UI.view')") == 'admit'
    assert 'tab-admit' in selected(page)


def test_desktop_todo_panel_and_rail_collapse(page, base_url):
    page.goto(base_url + 'index.html')
    page.wait_for_timeout(500)
    page.click('#todoClose')
    assert not page.is_visible('#pane-todo')
    assert page.evaluate("localStorage.getItem('hub.ui.side')") == '0'
    page.click('#sideToggle')
    assert page.is_visible('#pane-todo')
    w0 = page.evaluate("document.getElementById('rail').offsetWidth")
    page.click('#railToggle')
    assert page.evaluate("document.getElementById('rail').offsetWidth") < w0 / 2
    page.reload(); page.wait_for_timeout(400)
    assert 'rail-min' in page.get_attribute('#app', 'class')   # 記得上次的收合狀態
    assert page.errors == []


def test_phone_all_tools_sheet_and_pins(phone, base_url):
    phone.goto(base_url + 'index.html')
    phone.wait_for_timeout(600)
    nav = lambda: phone.evaluate("[...document.querySelectorAll('#mnav button')].map(b => b.id)")
    assert nav() == ['m-acls', 'm-pilot', 'm-admit', 'm-rounds', 'fab', 'mAll']
    assert phone.evaluate("document.documentElement.scrollWidth <= innerWidth")
    phone.click('#mAll')
    assert phone.is_visible('#sheet')
    phone.click('#s-labs')                      # 沒釘選的工具：從全部工具進去
    phone.wait_for_timeout(600)
    assert not phone.evaluate("document.getElementById('sheet').classList.contains('open')")
    assert phone.evaluate("JSON.parse(localStorage.getItem('hub.pane')).cur") == 'labs'
    assert phone.text_content('#mAllLb') == '正常值' and phone.get_attribute('#mAll', 'aria-selected') == 'true'
    # 釘選：滿了要先取消一個
    phone.click('#mAll')
    phone.click('[data-pin="labs"]')
    assert 'm-labs' not in nav() and phone.is_visible('.hub-toast')
    phone.click('[data-pin="admit"]')
    phone.click('[data-pin="labs"]')
    assert nav() == ['m-acls', 'm-pilot', 'm-rounds', 'm-labs', 'fab', 'mAll']
    phone.reload(); phone.wait_for_timeout(500)
    assert nav() == ['m-acls', 'm-pilot', 'm-rounds', 'm-labs', 'fab', 'mAll']
    assert phone.errors == []


def test_phone_swipe_track_follows_tool_order(phone, base_url):
    phone.goto(base_url + 'index.html#acls')
    phone.wait_for_timeout(800)
    phone.evaluate("document.getElementById('work').scrollTo({left: innerWidth * 3, behavior: 'instant'})")
    phone.wait_for_timeout(600)
    assert phone.evaluate("JSON.parse(localStorage.getItem('hub.pane')).cur") == 'consult'
    assert phone.evaluate("!!document.getElementById('f-consult').getAttribute('src')")


def test_android_hub(android, base_url):
    android.goto(base_url + 'index.html')
    android.wait_for_timeout(5000)
    assert android.evaluate("[...document.querySelectorAll('.pane iframe')].filter(f => f.getAttribute('src')).length") == 7
    assert android.is_visible('#mnav') and not android.is_visible('#rail')
    assert android.evaluate("document.documentElement.scrollWidth <= innerWidth")
    # 每個工具在 Android 寬度都不會左右溢出
    for k in ['acls', 'pilot', 'rounds', 'consult', 'meds', 'labs', 'todo']:
        assert android.evaluate(f"(d => d.documentElement.scrollWidth <= d.defaultView.innerWidth + 1)(document.getElementById('f-{k}').contentDocument)"), k
    # 返回鍵：先關掉待辦抽屜，不離開頁面
    android.click('#fab')
    assert 'open' in android.get_attribute('#pane-todo', 'class')
    android.go_back()
    android.wait_for_timeout(300)
    assert 'open' not in android.get_attribute('#pane-todo', 'class')
    assert android.url.endswith('index.html')
    android.click('#mAll')
    assert android.is_visible('#sheet')
    android.go_back()
    android.wait_for_timeout(300)
    assert not android.evaluate("document.getElementById('sheet').classList.contains('open')")
    assert android.errors == []


def test_android_each_tool_standalone(android, base_url):
    for k in ['acls', 'copilot', 'rounds', 'consult', 'meds', 'labs', 'todo']:
        android.goto(base_url + f'tools/{k}.html')
        android.wait_for_timeout(400)
        assert android.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), k
    assert android.errors == []


def test_ui_prefs_stay_on_this_device(page, base_url):
    """釘選、側欄收合是這台裝置的版面設定，不上雲端。"""
    from conftest import MOCK_CLOUD
    page.add_init_script(MOCK_CLOUD)
    page.goto(base_url + 'index.html')
    page.wait_for_timeout(1500)
    page.click('#railToggle')
    page.wait_for_timeout(4500)
    keys = page.evaluate("Object.keys(__store).map(id => new TextDecoder().decode(new Uint8Array(id.slice(1).match(/../g).map(h => parseInt(h, 16)))))")
    assert not [k for k in keys if k.startswith('hub.ui.')]
    assert 'hub.pane' in keys


# ── 接新病人 ──

def admit(pg, base_url):
    pg.goto(base_url + 'tools/copilot.html')
    pg.click('[data-act="admit-new"]')
    return pg


def test_admit_starts_with_prechart_and_tags_field_sources(page, base_url):
    admit(page, base_url)
    assert page.get_attribute('.wkbar [aria-current="step"]', 'data-ph') == 'pre'
    heads = page.evaluate("[...document.querySelectorAll('.wk-sec .fgroup-h h3')].map(h => h.textContent)")
    assert heads == ['病歷首頁、急診／門診紀錄', '護理入院評估', '生命徵象', '共病（Charlson）', '檢驗、影像報告']
    assert page.text_content('#row_allergy .srct') == '病歷・床邊核對'
    assert page.text_content('#row_occ .srct') == '護理紀錄'
    # 先查的欄位就是病歷欄位：這裡填，「5 病歷欄位」看得到
    page.fill('#af_age', '78'); page.fill('#af_allergy', 'NKDA'); page.fill('#af_bt', '38.5')
    page.click('#row_gender [data-v="男"]')
    page.click('[data-act="ax-pre-todo"]')
    assert page.locator('#row_age').count() == 0 and page.locator('#row_dept').count() == 1
    page.click('[data-ph="form"]')
    assert page.input_value('#af_age') == '78'
    assert page.text_content('#row_age .srct') == '病歷'
    page.click('[data-act="sec"][data-s="ros"]')
    assert page.text_content('#row_r_gen .srct') == '床邊'
    page.click('[data-act="sec"][data-s="plan"]')
    assert page.text_content('#row_imp .srct') == '回來寫'
    page.wait_for_timeout(600)
    a = json.loads(page.evaluate("localStorage.getItem('oncall.admit.v1')"))
    assert a['f']['bt'] == '38.5' and a['f']['gender'] == '男'
    assert page.errors == []


def test_every_admission_field_has_a_known_source(page, base_url):
    admit(page, base_url)
    bad = page.evaluate("Object.keys(FSRC).filter(k => !FIELD[k])")
    assert bad == []          # 來源表裡沒有打錯的欄位名
    pre = page.evaluate("PRE_SECS.flatMap(s => s.keys)")
    assert len(pre) == len(set(pre))
    assert page.evaluate("PRE_SECS.flatMap(s => s.keys).every(k => ['n', 'c'].includes(fsrcOf(k)))")
    # 所有標成護理紀錄／病歷的欄位，都排進了「先查病歷」
    assert page.evaluate("Object.keys(FSRC).filter(k => ['n', 'c'].includes(FSRC[k]) && !PRE_SECS.some(s => s.keys.includes(k)))") == []


def test_bedside_checklist_timeline_and_pi(page, base_url):
    admit(page, base_url)
    page.fill('#af_age', '78'); page.click('#row_gender [data-v="男"]'); page.fill('#af_meds', 'metformin')
    page.click('[data-ph="prep"]')
    page.click('[data-act="wk-pid"][data-id="fever"]')
    assert 'Bacteremia' in page.text_content('.think')
    page.fill('#axHyp', '最像肺炎')
    page.fill('#myqIn', '上次住院後有沒有回診'); page.press('#myqIn', 'Enter')
    page.fill('#myqIn', '家裡有沒有人發燒'); page.click('[data-axform="myq"] button')
    page.click('[data-ph="bed"]')
    foot = page.text_content('.bedfoot .small')
    assert '關鍵 0/12' in foot and '我的 0/2' in foot
    # 時間軸
    page.click('[data-act="ax-tl-add"][data-w="3 天前"]')
    page.keyboard.type('開始發燒')
    assert page.evaluate("document.activeElement.id") == 'tlx_0'
    # 關鍵資訊：先查到的值會帶出來提醒核對；可以直接在這裡補填
    assert 'metformin' in page.text_content('.kq:has([data-id="meds"])')
    page.click('[data-act="ax-kq"][data-id="meds"]')
    page.click('[data-act="ax-kq-open"][data-id="alg"]')
    page.fill('.kq-f #af_allergy', 'penicillin: rash')
    page.click('[data-act="ax-myq"][data-i="0"]')
    f1 = page.evaluate("BAYES.fever.f.find(a => a[3] === 'h')[0]")
    page.click(f'[data-act="wk-f"][data-f="{f1}"][data-v="+"]')
    foot = page.text_content('.bedfoot .small')
    assert '關鍵 1/12' in foot and '我的 1/2' in foot and '症狀 1/' in foot
    # 只看還沒問的
    page.click('[data-act="ax-bed-todo"]')
    assert not page.is_visible('[data-act="ax-kq"][data-id="meds"]')
    assert page.is_visible('[data-act="ax-kq"][data-id="alg"]')
    assert not page.is_visible(f'[data-act="wk-f"][data-f="{f1}"]')
    # 整理 PI：提醒漏問的，時間軸進草稿
    page.click('[data-ph="syn"]')
    box = page.text_content('.miss-box')
    assert '必須排除的鑑別，還沒問' in box and '家裡有沒有人發燒' in box and '上次住院後有沒有回診' not in box
    pi = page.input_value('#wkPI')
    assert '[3 天前：開始發燒]' in pi and '78-year-old man' in pi
    page.wait_for_timeout(600)
    a = json.loads(page.evaluate("localStorage.getItem('oncall.admit.v1')"))
    assert a['f']['allergy'] == 'penicillin: rash' and a['w']['hyp'] == '最像肺炎' and a['w']['tl'][0]['x'] == '開始發燒'
    # 換主訴類型：時間軸和自己要問的留著
    page.click('[data-ph="prep"]')
    page.click('[data-act="wk-pid"][data-id="dyspnea"]')
    w = page.evaluate("UI.admit.w")
    assert w['pid'] == 'dyspnea' and len(w['myq']) == 2 and w['tl'][0]['w'] == '3 天前' and w['fx'] == {}
    assert page.errors == []


def test_copy_for_ai_contains_the_interview(page, base_url):
    admit(page, base_url)
    page.fill('#af_age', '78'); page.fill('#af_cc', 'fever for 3 days')
    page.click('[data-ph="prep"]')
    page.click('[data-act="wk-pid"][data-id="fever"]')
    page.click('[data-ph="bed"]')
    page.click('[data-act="ax-tl-add"][data-w="昨天"]'); page.keyboard.type('到診所拿藥')
    page.click('[data-ph="syn"]')
    assert page.locator('[data-act="ax-ai"][data-full="0"]').count() == 1
    t = page.evaluate("aiPrompt(false)")
    for s in ['請幫我', '【主訴】\nfever for 3 days', '昨天：到診所拿藥', '【PI 草稿】', '沒問到：', '（必須排除）']:
        assert s in t, s
    assert '【整份 Admission note' not in t
    full = page.evaluate("aiPrompt(true)")
    assert '【整份 Admission note（目前的內容）】' in full and '【還沒填的必填欄位】' in full
    # 按鈕真的會複製
    page.context.grant_permissions(['clipboard-read', 'clipboard-write'])
    page.click('[data-act="ax-ai"][data-full="0"]')
    page.wait_for_timeout(200)
    assert page.evaluate("navigator.clipboard.readText()") == page.evaluate("aiPrompt(false)")
    page.click('[data-ph="form"]'); page.click('[data-act="sec"][data-s="out"]')
    assert page.locator('[data-act="ax-ai"][data-full="1"]').count() == 1
    assert page.errors == []


def test_complaint_not_in_list_still_gets_checklists(phone, base_url):
    admit(phone, base_url)
    phone.click('[data-ph="prep"]')
    phone.click('[data-act="wk-pid"][data-id="_free"]')
    assert phone.is_visible('.think')
    phone.click('[data-ph="bed"]')
    assert phone.locator('.kq').count() == 12 and phone.is_visible('[data-act="ax-tl-add"]')
    phone.click('[data-act="wk-lq"][data-k="dur"][data-i="1"]')
    phone.click('[data-ph="syn"]')
    assert 'for 1-3 days' in phone.input_value('#wkPI')
    phone.click('[data-act="wk-pe"]')
    phone.click('[data-ph="form"]')
    assert phone.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    phone.reload(); phone.wait_for_timeout(400)   # 重新載入：_free 不是內建主訴，也不能壞
    phone.click('[data-act="admit-new"]')
    assert phone.evaluate("UI.admit.w.pid") == '_free'
    assert phone.errors == []


def test_old_admission_notes_still_open(page, base_url):
    """v1.3 存下來的 note（沒有 tl／myq／kq、停在 prep）照樣能開、每一步都能進。"""
    old = {'f': {'age': '60', 'gender': '女'}, 'sec': 'basic', 'pid': 'fever', 'hx': {}, 'started': 1, 'done': None, 'ph': 'prep',
           'w': {'pid': 'fever', 'mine': [], 'hits': None, 'extra': [], 'revealed': True, 'inc': {}, 'lq': {}, 'ev': [], 'evTxt': {}, 'fx': {}, 'pf': {}, 'pre': {}, 'cust': [], 'ddx': {}, 'ed': '', 'order': None, 'imp': '', 'pi': '', 'qmine': '', 'qhits': None, 'blindRes': None}}
    page.goto(base_url + 'tools/copilot.html')
    page.evaluate("v => localStorage.setItem('oncall.admit.v1', v)", json.dumps(old))
    page.reload()
    page.click('[data-act="admit-new"]')
    for ph in ['pre', 'prep', 'bed', 'syn', 'form']:
        page.click(f'[data-ph="{ph}"]')
        assert page.get_attribute('.wkbar [aria-current="step"]', 'data-ph') == ph
    assert page.evaluate("aiPrompt(true).length") > 200
    assert page.errors == []


def test_elective_admission_flow(page, base_url):
    page.goto(base_url + 'tools/copilot.html')
    page.click('[data-act="admit-elec"]')
    assert page.evaluate("[...document.querySelectorAll('.wkbar [data-ph]')].map(b => b.dataset.ph)") == ['pre', 'prep', 'form']
    page.click('[data-ph="pre"]')
    assert page.locator('#row_allergy').count() == 1
    assert page.evaluate("aiPrompt(false).length") > 100
    assert page.errors == []


# ── 檢核後補的 ──

def test_typing_while_remote_arrives_keeps_what_i_typed(page, base_url):
    """正在打字時別台的版本進來：停下來後，畫面和儲存的都還是我打的（不會被扣住的舊版本換掉）。"""
    admit(page, base_url)
    page.click('[data-ph="prep"]'); page.click('[data-act="wk-pid"][data-id="fever"]'); page.click('[data-ph="bed"]')
    page.click('[data-act="ax-tl-add"][data-w="3 天前"]')
    page.keyboard.type('fever')
    page.wait_for_timeout(600)
    other = json.loads(page.evaluate("localStorage.getItem('oncall.admit.v1')"))
    other['w']['kq'] = {'open': 1}
    page.evaluate("v => window.dispatchEvent(new StorageEvent('storage', {key: 'oncall.admit.v1', newValue: v}))", json.dumps(other))
    page.keyboard.type(' and chills')
    page.wait_for_timeout(600)
    page.evaluate("document.activeElement.blur()")
    page.wait_for_timeout(200)
    assert page.input_value('#tlx_0') == 'fever and chills'
    assert json.loads(page.evaluate("localStorage.getItem('oncall.admit.v1')"))['w']['tl'][0]['x'] == 'fever and chills'


def test_admit_click_right_after_pilot_reload(page, base_url):
    page.goto(base_url + 'index.html#meds')
    page.wait_for_timeout(2500)
    page.evaluate("document.getElementById('pane-pilot').classList.contains('loaded') || 0")
    page.evaluate("(() => { const k = 'pilot'; document.querySelector('#pane-pilot .reload')?.remove(); })()")
    # 模擬自我修復的重載，緊接著點接新病人
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    page.evaluate("(() => { const f = document.getElementById('f-pilot'); f.contentDocument.body.replaceChildren(); document.dispatchEvent(new Event('visibilitychange')); document.getElementById('tab-admit').click(); })()")
    page.wait_for_timeout(2500)
    assert page.evaluate(f"{PILOT}.eval('UI.view')") == 'admit'
    assert 'tab-admit' in selected(page)


def test_broken_ui_prefs_do_not_break_the_hub(phone, base_url):
    phone.goto(base_url + 'index.html')
    phone.evaluate("localStorage.setItem('hub.ui.pins', '{}'); localStorage.setItem('hub.ui.recent', '5')")
    phone.reload(); phone.wait_for_timeout(600)
    assert phone.evaluate("[...document.querySelectorAll('#mnav button')].map(b => b.id)") == ['m-acls', 'm-pilot', 'm-admit', 'm-rounds', 'fab', 'mAll']
    phone.click('#m-rounds')
    assert phone.errors == []


def test_close_then_reopen_overlay_immediately(phone, base_url):
    phone.goto(base_url + 'index.html')
    phone.wait_for_timeout(600)
    phone.click('#fab')
    phone.evaluate("document.getElementById('scrim').click(); document.getElementById('fab').click()")
    phone.wait_for_timeout(300)
    assert 'open' in phone.get_attribute('#pane-todo', 'class')
    phone.go_back(); phone.wait_for_timeout(300)
    assert 'open' not in phone.get_attribute('#pane-todo', 'class')
    assert phone.url.endswith('index.html')


def test_prechart_filter_keeps_row_and_counts_update_while_typing(page, base_url):
    admit(page, base_url)
    page.click('[data-act="ax-pre-todo"]')
    page.click('#row_gender [data-v="男"]')
    assert page.locator('#row_gender').count() == 1      # 剛填的不會馬上消失，點錯還能改
    page.fill('#af_age', '70')
    page.wait_for_timeout(400)
    assert page.text_content('[data-pc="all"]').startswith('已填 6/')   # 預設帶 src、info、tool、tadm＋剛填的兩項
    assert page.evaluate("document.activeElement.id") == 'af_age'


def test_hashchange_switches_tool(page, base_url):
    page.goto(base_url + 'index.html#meds')
    page.wait_for_timeout(500)
    page.evaluate("location.hash = '#rounds'")
    page.wait_for_timeout(300)
    assert 'tab-rounds' in selected(page)


def test_last_edit_is_saved_when_page_hides(page, base_url):
    admit(page, base_url)
    page.fill('#af_age', '81')
    page.evaluate("window.dispatchEvent(new Event('pagehide'))")   # 不等 0.4 秒
    assert json.loads(page.evaluate("localStorage.getItem('oncall.admit.v1')"))['f']['age'] == '81'
