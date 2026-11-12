"""查房板：DNR 顯示、追蹤點進待辦、單床總覽卡片、檢驗匯入（檢體、累積報告、趨勢）。"""
import datetime as dt
import json


def bed(**kw):
    b = {'id': 'b1', 'bed': '18', 'code': 'W', 'dx': 'CAP', 'hx': '', 'dnr': '', 'io': '', 'lines': [], 'abx': [],
         'problems': [], 'pending': [], 'labs': {}, 'checks': {}, 'note': '', 'hand': '', 'learned': [], 'rounded': '', 'created': '2026-11-01'}
    b.update(kw)
    return b


def seed(pg, base_url, *beds):
    pg.goto(base_url + 'tools/rounds.html')
    pg.evaluate("s => localStorage.setItem('rounds.v1', s)", json.dumps({'beds': list(beds), 'lastExport': 9e12, 'hidden': [], 'where': {}, 'v': 1}))
    pg.reload()


def rounds(pg):
    return json.loads(pg.evaluate("localStorage.getItem('rounds.v1')"))


def board(pg):
    return json.loads(pg.evaluate("localStorage.getItem('shiftboard.v1') || '{\"items\":[]}'"))


def open_bed(pg):
    pg.click('.bed[data-id="b1"]')


def test_dnr_shows_its_label_in_the_list(phone, base_url):
    seed(phone, base_url, bed(dnr='NO'))
    tag = phone.locator('.bed .tag.dnr')
    assert tag.inner_text() == 'DNR：NO'
    # 長的寫法不能被截斷：標籤要能換行，寬度不超過卡片
    seed(phone, base_url, bed(dnr='部分 DNR（不插管、不壓胸、不電擊、不用升壓劑）'))
    box, card = phone.locator('.bed .tag.dnr').bounding_box(), phone.locator('.bed').bounding_box()
    assert box['x'] + box['width'] <= card['x'] + card['width'] + 1
    assert phone.errors == []


def test_dnr_quick_options(page, base_url):
    seed(page, base_url, bed())
    open_bed(page)
    page.click('.bcard[data-v="basic"]')
    page.click('[data-act="dnrPick"][data-v="未簽（Full code）"]')
    assert rounds(page)['beds'][0]['dnr'] == '未簽（Full code）'


def test_followup_for_next_week_goes_to_todo_now(page, base_url):
    seed(page, base_url, bed(problems=[{'id': 'p1', 'name': '肺炎', 'tpl': '', 'status': 'same', 'plan': '', 'since': '2026-11-01', 'fus': []}]))
    open_bed(page)
    page.click('.bcard[data-v="prob"]')
    page.click('[data-act="pOpen"][data-p="p1"]')
    nxt = (dt.date.today() + dt.timedelta(days=5)).isoformat()
    page.fill('[data-fuin="p1"]', 'f/u CXR')
    page.fill('[data-fudate="p1"]', nxt)
    page.click('[data-act="fuAdd"][data-p="p1"]')
    items = board(page)['items']
    assert [i['text'] for i in items] == ['肺炎：f/u CXR']
    due = dt.datetime.fromtimestamp(items[0]['due'] / 1000)
    assert (due.date().isoformat(), due.hour) == (nxt, 8)
    # 刪掉追蹤點，待辦也跟著刪，並留下刪除紀錄
    page.click('[data-act="fuDel"][data-p="p1"]')
    st = board(page)
    assert st['items'] == [] and items[0]['id'] in st['del']


def test_bed_page_opens_on_overview_cards(phone, base_url):
    probs = [{'id': f'p{i}', 'name': f'問題{i}', 'tpl': '', 'status': 'same', 'plan': '', 'since': '2026-11-01',
              'fus': [{'id': f'f{i}', 'what': 'x', 'when': '', 'due': '2099-01-01', 'done': False, 'pushed': True}]} for i in range(8)]
    seed(phone, base_url, bed(problems=probs, abx=[{'id': 'a', 'name': 'Ceftriaxone', 'start': '2026-11-10', 'days': 7, 'cx': ''}]))
    open_bed(phone)
    cards = phone.locator('.bcard .bh').all_inner_texts()
    assert {'基本資料', 'Problem', '檢驗', '抗生素', '等結果'} <= set(cards)
    # 點「抗生素」只看那一區，不用滑過 8 個 problem
    phone.click('.bcard[data-v="abx"]')
    assert phone.locator('#bedBody h2').all_inner_texts()[0].startswith('抗生素')
    assert phone.locator('[data-pf="plan"]').count() == 0
    # Problem 分頁：每個 problem 收成一行，點開才編輯
    phone.click('#btabs [data-v="prob"]')
    assert phone.locator('.item.pcol').count() == 8
    phone.click('.item.pcol[data-p="p3"]')
    assert phone.locator('[data-pf="plan"]').count() == 1
    assert phone.evaluate('document.documentElement.scrollWidth') <= 390
    assert phone.errors == []


def go_import(pg, text, spec=None):
    pg.click('[data-act="import"]')
    pg.fill('#impBed', '18')
    if spec:
        pg.click(f'[data-act="impSpec"][data-v="{spec}"]')
    pg.fill('#impText', text)
    pg.click('[data-act="impParse"]')


def test_urine_values_are_kept_apart_from_blood(page, base_url):
    seed(page, base_url, bed())
    go_import(page, 'Na 138 K 4.1 Cr 1.0\n尿液檢查\nNa 45\nK 30\nCr 80\nSG 1.015')
    names = page.locator('.imp b').evaluate_all('els => els.map(e => e.firstChild.textContent)')
    assert names == ['Na', 'K', 'Cr', '尿 Na', '尿 K', '尿 Cr', '尿 SG']
    page.click('[data-act="impSave"]')
    labs = rounds(page)['beds'][0]['labs']
    assert labs['Na'][0]['v'] == 138 and labs['U-Na'][0]['v'] == 45 and labs['U-SG'][0]['v'] == 1.015


def test_urine_marker_next_to_item(page, base_url):
    seed(page, base_url, bed())
    go_import(page, 'Na 140 K 3.9 Na(U) 60 U-K 25')
    page.click('[data-act="impSave"]')
    labs = rounds(page)['beds'][0]['labs']
    assert (labs['Na'][0]['v'], labs['K'][0]['v'], labs['U-Na'][0]['v'], labs['U-K'][0]['v']) == (140, 3.9, 60, 25)


def test_choose_urine_and_swap_back(page, base_url):
    seed(page, base_url, bed())
    go_import(page, 'Na 52 K 33', spec='U')
    page.click('[data-act="impSwap"][data-id="U-K"]')   # K 其實是血液的
    page.click('[data-act="impSave"]')
    labs = rounds(page)['beds'][0]['labs']
    assert set(labs) == {'U-Na', 'K'} and labs['K'][0]['v'] == 33


def test_cumulative_report_imports_each_day(page, base_url):
    seed(page, base_url, bed())
    txt = '項目\t2026/11/08\t2026/11/09\t2026/11/10\nNa\t135\t\t131\nK\t3.1\t2.9\t3.4\nCr\t1.2\t1.4\t1.3'
    go_import(page, txt)
    assert page.locator('[data-mdate]').evaluate_all('els => els.map(e => e.value)') == ['2026-11-08', '2026-11-09', '2026-11-10']
    page.click('[data-act="impSave"]')
    labs = rounds(page)['beds'][0]['labs']
    assert [(x['d'], x['v']) for x in labs['Na']] == [('2026-11-08', 135), ('2026-11-10', 131)]
    assert [x['v'] for x in labs['K']] == [3.1, 2.9, 3.4]
    # 點一項看全部紀錄和折線
    page.click('#btabs [data-v="labs"]') if page.locator('#btabs [data-v="labs"]').is_visible() else None
    page.click('.labr[data-id="K"]')
    assert page.locator('.labh .fu .w').all_inner_texts() == ['11/10', '11/09', '11/08']
    assert page.locator('.labh svg.spark circle').count() == 3


def test_cumulative_report_with_spaces_and_roc_dates(page, base_url):
    seed(page, base_url, bed())
    txt = '        115/11/08  115/11/09\nNa      135        133      (135-145)\nK       3.2        3.6      3.5-5.0\nHb      9.1'
    go_import(page, txt)
    page.click('[data-act="impSave"]')
    labs = rounds(page)['beds'][0]['labs']
    assert [(x['d'], x['v']) for x in labs['Na']] == [('2026-11-08', 135), ('2026-11-09', 133)]
    assert [x['v'] for x in labs['K']] == [3.2, 3.6]
    assert 'Hb' not in labs   # 數字個數對不起來的不收


def test_report_date_line_is_not_a_table(page, base_url):
    seed(page, base_url, bed())
    go_import(page, '採檢日期 2026/11/10 報告日期 2026/11/11\nNa 138 135-145\nK 4.0')
    assert page.locator('[data-mdate]').count() == 0
    assert page.locator('[data-iv="Na"]').input_value() == '138'


def test_import_has_camera_buttons_that_ask_for_camera(phone, base_url):
    """Android 14 以後 accept="image/*" 沒有 capture 會直接開系統相簿（沒有相機選項）：拍照、掃 QR 都要有 capture。"""
    seed(phone, base_url, bed())
    phone.click('[data-act="import"]')
    for act in ('impCam', 'impScan'):
        with phone.expect_file_chooser() as fc:
            phone.click(f'[data-act="{act}"]')
        el = fc.value.element
        assert el.get_attribute('capture') == 'environment', act
        assert el.get_attribute('accept') == 'image/*'
    with phone.expect_file_chooser() as fc:   # 從相簿選截圖的按鈕還在
        phone.click('[data-act="impPick"]')
    assert fc.value.element.get_attribute('capture') is None
    assert phone.errors == []
