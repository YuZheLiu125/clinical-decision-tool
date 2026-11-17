"""貼上就抓 vital sign 與檢驗（shared/paste.js）：主訴處理、會診稿共用。"""
import json

import pytest

CASES = [
    ('BT 38.6, BP 92/58 mmHg, HR 118, RR 24, SpO2 91% (NC 3L), GCS E3V4M6, finger sugar 256',
     {'bt': '38.6', 'sbp': '92', 'dbp': '58', 'pr': '118', 'rr': '24', 'spo2': '91', 'sugar': '256', 'gcs': 'E3V4M6'}, {}),
    ('TPR: 36.8/88/18  BP:132/76  SPO2:97%', {'bt': '36.8', 'pr': '88', 'rr': '18', 'sbp': '132', 'dbp': '76', 'spo2': '97'}, {}),
    ('體溫：38.2℃ 脈搏：102 次/分 呼吸：20 次/分 血壓：100／62 mmHg 血氧：95％ 血糖 68',
     {'bt': '38.2', 'pr': '102', 'rr': '20', 'sbp': '100', 'dbp': '62', 'spo2': '95', 'sugar': '68'}, {}),
    # T/P/R 單一字母要有冒號才算；脈搏 P:110 不能被當成磷，後面真正的 P 5.2 要抓到
    ('T:37.5 P:110 R:22 BP:88/50\nWBC 15.2 Hb 8.9 PLT 98 Na 128 K 5.9 BUN 45 Cr 2.3 eGFR 25 P 5.2',
     {'bt': '37.5', 'pr': '110', 'rr': '22', 'sbp': '88', 'dbp': '50'},
     {'WBC': [15.2, 'H'], 'Hb': [8.9, 'L'], 'Plt': [98, 'L'], 'Na': [128, 'L'], 'K': [5.9, 'H'], 'BUN': [45, 'H'], 'Cr': [2.3, 'H'], 'eGFR': [25, 'L'], 'P': [5.2, 'H']}),
    # 括號註記、旗標字母、逗號小數點、尿液段落不收
    ('Na(B) 133 mEq/L\nK(B) 3.1 L mEq/L\nCreatinine 1,8 H\nGOT 88 pH 7.28 HCO3- 14\nUrine\nNa 40 K 22',
     {}, {'Na': [133, 'L'], 'K': [3.1, 'L'], 'Cr': [1.8, 'H'], 'AST': [88, 'H'], 'pH': [7.28, 'L'], 'HCO3': [14, 'L']}),
    # 長的名稱先比對：NT-proBNP 不會被 BNP 吃掉；K/uL 不是鉀；PT 不是 P
    ('K/uL Hb 12 PT 14 NT-proBNP 3200 BNP 80 CK 1200', {}, {'Hb': [12, ''], 'NT-proBNP': [3200, 'H'], 'BNP': [80, ''], 'CK': [1200, 'H']}),
    ('病人說胸口悶，昨天睡不好', {}, {}),
]


@pytest.mark.parametrize('text,vitals,labs', CASES)
def test_parser(page, base_url, text, vitals, labs):
    page.goto(base_url + 'tools/consult.html')
    r = page.evaluate('t => pasteParse(t)', text)
    assert r['v'] == vitals
    assert {l[0]: [l[1], l[2]] for l in r['labs']} == labs


def test_copilot_paste_fills_vitals_labs_and_note(page, base_url):
    page.goto(base_url + 'tools/copilot.html')
    page.evaluate("startCall('fever'); UI.bedAsk = false; render()")
    page.click('[data-act="paste-open"]')
    page.fill('#pasteTxt', 'BT 38.9 BP 86/50 HR 124 RR 26 SpO2 92%\nWBC 18.2 Lactate 4.1 Cr 2.0 eGFR 28')
    assert 'BP 86/50' in page.inner_text('#pastePrev') and '檢驗 4 項' in page.inner_text('#pastePrev')
    page.click('[data-act="paste-apply"]')
    assert page.input_value('#v_bt') == '38.9' and page.input_value('#v_sbp') == '86' and page.input_value('#v_pr') == '124'
    assert page.locator('.labc').count() == 4 and page.locator('.labc.abn').count() == 4
    note = page.evaluate('callNote()')
    assert 'BT 38.9°C, BP 86/50 mmHg' in note and 'Lab: WBC 18.2 (H), Cr 2 (H), eGFR 28 (L), Lactate 4.1 (H)' in note
    # 生命徵象進了貝氏推論（SBP <90）、eGFR 帶到醫囑的腎功能
    assert page.evaluate("VSD.sbp90(cur())") == '+' and page.evaluate("cur().px.rn") == 'r30'
    page.click('[data-act="paste-clear"]')
    assert page.locator('.labc').count() == 0 and 'Lab:' not in page.evaluate('callNote()')
    assert page.errors == []


def test_copilot_pasting_into_one_vital_box_spreads_the_values(page, base_url):
    page.goto(base_url + 'tools/copilot.html')
    page.evaluate("startCall('dyspnea'); UI.bedAsk = false; render()")
    page.focus('#v_bt')
    page.evaluate("""() => { const dt = new DataTransfer(); dt.setData('text', 'TPR 37.2/96/20 BP 150/90');
      document.getElementById('v_bt').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""")
    assert [page.input_value('#v_' + k) for k in ['bt', 'pr', 'rr', 'sbp', 'dbp']] == ['37.2', '96', '20', '150', '90']
    # 只貼一個數字：照原本的行為，不攔截
    page.evaluate("""() => { const dt = new DataTransfer(); dt.setData('text', '98');
      window.__kept = document.getElementById('v_spo2').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""")
    assert page.evaluate('window.__kept') is True


def test_copilot_reason_text_fills_only_empty_vitals(page, base_url):
    page.goto(base_url + 'tools/copilot.html')
    page.evaluate("startCall('fever'); UI.bedAsk = false; render()")
    page.fill('#v_pr', '99')
    page.fill('#reason', 'BT 38.6, HR 120, chills')
    page.dispatch_event('#reason', 'change')
    assert page.input_value('#v_bt') == '38.6' and page.input_value('#v_pr') == '99'
    assert page.input_value('#reason') == 'BT 38.6, HR 120, chills'


def test_consult_paste_fills_form_and_keeps_trend(page, base_url):
    page.goto(base_url + 'tools/consult.html')
    page.fill('#hr', '108'); page.fill('#bp', '102/64'); page.fill('#find', 'FAST 有液體')
    page.click('#pasteBox summary')
    assert page.is_disabled('#pasteApply')
    page.fill('#pasteTxt', 'BP 84/50 HR 128 RR 26 SpO2 94% BT 36.2 E3V4M6\nHb 6.8 Na 138 Lactate 4.2')
    assert '異常 2 項' in page.inner_text('#pastePrev')
    page.click('#pasteApply')
    assert [page.input_value('#' + k) for k in ['hr', 'bp', 'rr', 'spo2', 'bt']] == ['128', '84/50', '26', '94', '36.2']
    # 原本的 HR／BP 移到「之前」，稿子裡就有趨勢
    assert page.input_value('#prevHr') == '108' and page.input_value('#prevBp') == '102/64'
    assert page.input_value('#look') == 'GCS E3V4M6'
    assert page.input_value('#find') == 'FAST 有液體；Hb 6.8 (L), Lactate 4.2 (H)'
    script = page.inner_text('#script')
    assert 'HR 128' in script and 'BP 84/50' in script and 'Hb 6.8 (L)' in script
    assert json.loads(page.evaluate("localStorage.getItem('consult-draft')"))['hr'] == '128'
    # 貼上的原文不留在畫面上、也不存進草稿
    assert page.input_value('#pasteTxt') == '' and 'pasteTxt' not in page.evaluate("localStorage.getItem('consult-draft')")
    assert page.errors == []
