"""多裝置：新畫面在各種寬度不會橫向溢出、觸控目標夠大；Android（Chromium）與 iPhone／iPad（WebKit）都跑得動。"""
import pytest

# (寬, 高, 說明)
SIZES = [(320, 568, '小手機'), (360, 740, 'Android 常見'), (412, 915, 'Pixel'), (600, 960, '折疊機展開／小平板'),
         (768, 1024, 'iPad 直放'), (844, 390, '手機橫放'), (1024, 768, 'iPad 橫放'), (1366, 800, '筆電')]

SCREENS = {
    'copilot-orders': ('tools/copilot.html', "startCall('pain'); cur().step = 4; UI.bedAsk = false; pxOf(cur()).rn = 'hd'; pxOf(cur()).wt = '60'; render(); document.querySelectorAll('.rxd').forEach(d => d.open = true)"),
    'copilot-paste': ('tools/copilot.html', "startCall('aki'); UI.bedAsk = false; render(); pasteApply(cur(), 'WBC 15.2 Hb 8.9 Plt 98 Na 128 K 5.9 BUN 45 Cr 2.3 eGFR 25 CRP 12.4 Lactate 3.1 AST 88 ALT 120 INR 1.9'); UI.paste = {open: true, txt: 'BT 38 BP 90/50'}; pasteRefresh()"),
    'copilot-home': ('tools/copilot.html', "1"),
    'acls-sed': ('tools/acls.html#sed', "(w => { w.value = '72'; w.dispatchEvent(new Event('input', {bubbles: true})); })(document.getElementById('sedWt')); document.querySelector('[data-sed=elderly]').click()"),
    'meds-rx': ('tools/meds.html#rx-abx', "S.rn = {egfr: '25', wt: '60'}; S.st = ['hepatic', 'elderly']; render()"),
    'meds-topic-links': ('tools/meds.html#bowel', "1"),
    'consult-paste': ('tools/consult.html', "document.getElementById('pasteBox').open = true; (t => { t.value = 'BP 84/50 HR 128 Hb 6.8 Lactate 4.2 Na 128 K 5.9 Cr 2.3 WBC 18'; t.dispatchEvent(new Event('input', {bubbles: true})); })(document.getElementById('pasteTxt'))"),
}
OVERFLOW = "Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth"


@pytest.mark.parametrize('w,h,name', SIZES)
def test_no_horizontal_overflow_at_any_width(browser, base_url, w, h, name):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, has_touch=w < 1100, is_mobile=w < 1100)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    bad = []
    for key, (url, js) in SCREENS.items():
        pg.goto(base_url + url); pg.evaluate(js)
        over = pg.evaluate(OVERFLOW)
        if over > 1: bad.append(f'{key}: 超出 {over}px')
    ctx.close()
    assert bad == [] and errs == []


TARGETS = {
    'copilot-orders': '.pxbar .seg button, .pxbar .chip, .rxd summary, .pxwt .inp, .rxb .mini',
    'copilot-paste': '.pastebox .btn, .labrow .mini',
    'acls-sed': '.sedchips button, #sedWt',
    'meds-rx': '.rxd summary, .xl',
    'consult-paste': '#pasteBox summary, #pasteApply, .pasteall',
}


@pytest.mark.parametrize('key', TARGETS)
def test_new_controls_are_big_enough_for_fingers(android, base_url, key):
    url, js = SCREENS[key]
    android.goto(base_url + url); android.evaluate(js)
    small = android.evaluate("""sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent).map(e => [e.className || e.id || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44)""", TARGETS[key])
    assert android.locator(TARGETS[key]).count() > 0 and small == []


def test_android_keyboard_comma_decimal_weight(android, base_url):
    """有些 Android 鍵盤的小數點是逗號：60,5 kg 要算得出劑量。"""
    android.goto(base_url + 'tools/acls.html#sed')
    android.fill('#sedWt', '60,5')
    assert '60.5 kg →' in android.locator('.sedi').first.inner_text()


def test_safari_engine_runs_the_new_features(iphone, base_url):
    """WebKit（iPhone、iPad 上所有瀏覽器的引擎）：醫囑調整、鎮靜分頁、貼上解析、用藥速查。"""
    iphone.goto(base_url + 'tools/copilot.html')
    iphone.evaluate("startCall('hypok'); cur().step = 4; UI.bedAsk = false; render()")
    iphone.tap('[data-act="px-rn"][data-v="r30"]')
    assert iphone.locator('.rxi .rxo').first.inner_text() == 'KCl 10 mEq PO once; recheck K in 4–6 h'
    iphone.evaluate("cur().step = 0; render()")
    iphone.tap('[data-act="paste-open"]')
    iphone.fill('#pasteTxt', 'T:37.5 P:110 R:22 BP:88/50 K 5.9 P 5.2')
    iphone.tap('[data-act="paste-apply"]')
    assert iphone.input_value('#v_pr') == '110' and iphone.locator('.labc').count() == 2
    assert iphone.evaluate(OVERFLOW) <= 1
    iphone.goto(base_url + 'tools/acls.html#sed')
    iphone.fill('#sedWt', '60')
    assert '60 kg → 6–9 mg' in iphone.locator('.sedi').first.inner_text()
    iphone.goto(base_url + 'tools/meds.html#rx-lyte')
    assert iphone.locator('.rxit').count() > 10 and iphone.evaluate(OVERFLOW) <= 1
    iphone.goto(base_url + 'tools/consult.html')
    iphone.tap('#pasteBox summary')
    iphone.fill('#pasteTxt', 'BP 84/50 HR 128 Hb 6.8')
    iphone.tap('#pasteApply')
    assert iphone.input_value('#bp') == '84/50' and 'Hb 6.8 (L)' in iphone.input_value('#find')
    assert iphone.errors == []


def test_hub_cross_tool_links_on_android(android, base_url):
    android.goto(base_url + 'index.html#meds')
    meds = android.frame_locator('#f-meds')
    meds.locator('.nb[data-tid="rx-lyte"]').tap()
    meds.locator('.xl[data-cc="hypok"]').tap()
    android.wait_for_function("document.getElementById('pane-pilot').classList.contains('on')")
    android.frame_locator('#f-pilot').locator('h1', has_text='低血鉀').wait_for()
    assert android.errors == []
