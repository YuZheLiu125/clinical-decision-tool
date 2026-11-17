"""共用醫囑庫（shared/rx.js）：主訴處理、用藥速查、ACLS 用同一份；醫囑會依腎功能與病人條件調整。"""
import pytest

NEW_CC = ['hypok', 'hyperna', 'hypoca', 'hyperca', 'hypomgp', 'anemia', 'txrxn', 'allergy', 'constipation', 'retention', 'hemoptysis',
          'stroke', 'withdrawal', 'aki', 'coag', 'wound', 'death', 'dizzy', 'hiccup', 'aspiration', 'cough', 'extravasation']


def open_orders(pg, base_url, pid):
    pg.goto(base_url + 'tools/copilot.html')
    pg.evaluate(f"startCall('{pid}'); cur().step = 4; UI.bedAsk = false; render()")


def test_every_order_names_dose_route_and_timing(page, base_url):
    """每一筆醫囑都要有劑量單位、途徑，以及頻次或給藥時間；調整後的替代醫囑也一樣。"""
    page.goto(base_url + 'tools/copilot.html')
    bad = page.evaluate("""() => {
      const unit = /\\d\\s*(mg|g|mcg|mEq|mmol|U|IU|mL|L|tab|pc|%)\\b|L\\/min/, route = /\\b(PO|IV|IVD|IM|SC|SL|PR|NG|nebulization|nasal cannula|suppository)\\b/,
        time = /\\b(q\\d|QD|BID|TID|QID|HS|QOD|once|over|PRN|stat|min\\b|\\/h\\b|mL\\/h|mcg\\/kg|U\\/kg|mg\\/h|every|then|after each|IV push|titrate)/i;
      const out = [];
      for (const x of Object.values(RX)) for (const o of [x.o, ...Object.values(x.alt || {})])
        if (!unit.test(o) || !route.test(o) || !time.test(o)) out.push(x.id + ': ' + o);
      return out;
    }""")
    assert bad == []
    assert page.errors == []


def test_protocol_orders_resolve_and_new_complaints_exist(page, base_url):
    page.goto(base_url + 'tools/copilot.html')
    ids = page.evaluate("BUILTIN.map(p => p.id)")
    assert len(ids) == len(set(ids)) >= 49
    assert set(NEW_CC) <= set(ids)
    # 主訴用到的醫囑庫 id 都存在；醫囑庫標的主訴 id 也都存在（用藥速查連回主訴處理用）
    assert page.evaluate("BUILTIN.flatMap(p => p.ord).filter(o => o.rx && !RX[o.rx]).length") == 0
    assert page.evaluate("Object.values(RX).filter(x => x.cc && !PMAP[x.cc]).map(x => x.id)") == []
    # 首頁每個主訴都看得到，而且只出現一次
    assert sorted(page.evaluate("[...document.querySelectorAll('.ccchip')].map(b => b.dataset.id)")) == sorted(ids)


@pytest.mark.parametrize('pid', NEW_CC)
def test_new_complaint_runs_through_all_steps(page, base_url, pid):
    page.goto(base_url + 'tools/copilot.html')
    page.click(f'.ccchip[data-id="{pid}"]')
    for step in range(6):
        page.evaluate(f"cur().step = {step}; UI.bedAsk = false; render()")
        assert page.locator('#stepBody').inner_text().strip()
    assert 'Called for:' in page.evaluate("callNote()")
    assert page.errors == []


def test_renal_choice_swaps_the_order_text(page, base_url):
    open_orders(page, base_url, 'hypok')
    first = page.locator('.rxi .rxo').first
    assert first.inner_text() == 'KCl 20 mEq PO BID with meals; recheck K next morning'
    page.click('[data-act="px-rn"][data-v="r30"]')
    assert page.locator('.rxi .rxo').first.inner_text() == 'KCl 10 mEq PO once; recheck K in 4–6 h'
    assert page.locator('.rxi').first.locator('.tag.adj').count() == 1
    assert 'eGFR <30' in page.locator('.rxi').first.locator('.rxn').inner_text()
    # 開立後，複製的醫囑與 note 用的是調整後的那一句
    page.locator('.rxi').first.locator('[data-act="ord"][data-v="o"]').click()
    assert page.evaluate("ordersText()") == '1. KCl 10 mEq PO once; recheck K in 4–6 h'
    assert 'KCl 10 mEq PO once' in page.evaluate("callNote()")
    # 病人條件跟著這個 call 存起來，重新載入還在
    page.evaluate("flushDraft()")
    page.reload()
    assert page.evaluate("UI.calls[0].px.rn") == 'r30'
    assert page.errors == []


def test_contraindicated_order_is_flagged_not_silently_kept(page, base_url):
    open_orders(page, base_url, 'pain')
    page.click('[data-act="px-rn"][data-v="hd"]')
    ket = page.locator('.rxi', has_text='Ketorolac')
    assert ket.locator('.tag.must').count() == 1 and 'rx-x' in ket.get_attribute('class')
    # Morphine 在透析病人換成 Fentanyl（有替代醫囑就換，不是只標禁用）
    mor = page.locator('.rxi', has_text='Morphine 靜脈')
    assert mor.locator('.rxo').inner_text().startswith('Fentanyl 25 mcg IV')


def test_weight_fills_in_dose_without_losing_focus(page, base_url):
    open_orders(page, base_url, 'seizure')
    page.fill('#pxWt', '50')
    assert page.evaluate("document.activeElement.id") == 'pxWt'
    assert page.locator('[data-rxk="levetiracetam_load"]').inner_text() == '50 kg → 3000 mg'


def test_order_detail_stays_open_across_rerender(page, base_url):
    open_orders(page, base_url, 'hypok')
    page.locator('.rxi').first.locator('summary').click()
    page.click('[data-act="px-flag"][data-k="hf"]')
    assert page.locator('.rxi').first.locator('details').get_attribute('open') is not None


def test_acls_sedation_tab_has_doses_by_weight(page, base_url):
    page.goto(base_url + 'tools/acls.html#tachy')
    page.click('#p-tachy [data-go="sed"]')
    assert page.locator('#p-sed').is_visible() and page.get_attribute('#tabs [data-t="sed"]', 'aria-selected') == 'true'
    assert page.locator('#sedBody .sedi').count() == 14
    page.fill('#sedWt', '60')
    eto = page.locator('.sedi', has_text='Etomidate').first
    assert '60 kg → 6–9 mg' in eto.inner_text()
    page.click('[data-sed="elderly"]')
    assert 'Midazolam 0.5–1 mg IV' in page.locator('.sedi', has_text='Midazolam').first.locator('.sedo').inner_text()
    page.click('[data-sed="r30"]')
    assert page.locator('.sedi.x', has_text='Succinylcholine').count() == 1
    assert page.errors == []


def test_meds_duty_orders_follow_renal_function(page, base_url):
    page.goto(base_url + 'tools/meds.html#rx-abx')
    assert page.locator('.topic h2').inner_text() == '抗生素（含腎劑量）'
    assert [h.strip() for h in page.locator('.nav h3').all_inner_texts()] == ['值班醫囑', '症狀用藥', '急症', '慢性病長期用藥', '住院常規']
    cef = page.locator('.rxit', has_text='Cefepime')
    assert cef.locator('.rxo').inner_text() == 'Cefepime 2 g IV q8h'
    page.evaluate("S.rn = {egfr: '25'}; save(); render()")
    assert cef.locator('.rxo').inner_text() == 'Cefepime 2 g IV q24h'
    page.evaluate("S.rn = {hd: true}; save(); render()")
    assert cef.locator('.rxo').inner_text().startswith('Cefepime 1 g IV q24h')
    # 既有主題數量不變，搜尋找得到醫囑庫裡的藥
    assert page.evaluate("T.filter(t => !t.rx).length") == 21
    page.fill('#q', 'Levetiracetam')
    assert page.locator('.topic', has_text='神經・精神').count() == 1
    assert page.errors == []


def test_meds_and_copilot_open_each_other_inside_the_hub(page, base_url):
    page.goto(base_url + 'index.html#meds')
    meds = page.frame_locator('#f-meds')
    meds.locator('.nb[data-tid="rx-lyte"]').click()
    meds.locator('.xl[data-cc="hypok"]').click()
    page.wait_for_function("document.getElementById('pane-pilot').classList.contains('on')")
    pilot = page.frame_locator('#f-pilot')
    pilot.locator('h1, h2', has_text='低血鉀').first.wait_for()
    page.evaluate("document.getElementById('f-pilot').contentWindow.eval('cur().step = 4; UI.bedAsk = false; render()')")
    pilot.locator('.rxi summary').first.click()
    pilot.locator('[data-act="rx-ref"]').first.click()
    page.wait_for_function("document.getElementById('pane-meds').classList.contains('on')")
    assert meds.locator('.topic h2').inner_text() == '電解質矯正'
    assert page.errors == []


def test_hub_ignores_open_requests_from_outside(page, base_url):
    page.goto(base_url + 'index.html#acls')
    page.evaluate("window.postMessage({hub: 'open', tool: 'meds', view: 'rx-lyte'}, '*')")
    page.wait_for_timeout(300)
    assert not page.evaluate("document.getElementById('pane-meds').classList.contains('on')")


def test_standalone_deep_links(page, base_url):
    page.goto(base_url + 'tools/copilot.html#cc-aki')
    assert page.evaluate("UI.view + ':' + cur().pid") == 'call:aki'
    assert page.evaluate("location.hash") == ''
