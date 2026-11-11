"""ACLS：急救狀態要撐過重新載入；重設要按兩次。"""
import json


def log_lines(pg):
    return pg.evaluate("[...document.querySelectorAll('#log div')].map(d => d.textContent.replace(/^\\S+\\s+/, ''))")


def test_code_survives_reload(page, base_url):
    page.goto(base_url + 'tools/acls.html#timer')
    page.evaluate("localStorage.setItem('acls-scen', 'vf')")
    page.reload()
    page.click('#actions [data-a="start"]')
    page.click('#actions [data-a="shock"]')
    page.click('#actions [data-a="epi"]')
    page.reload()
    page.wait_for_timeout(600)
    lines = log_lines(page)
    assert len(lines) == 3 and lines[0].startswith('Epinephrine') and lines[2].startswith('開始 CPR')
    run = json.loads(page.evaluate("localStorage.getItem('acls-run')"))
    assert run['S']['c'] == {'shock': 1, 'epi': 1}
    assert page.errors == []


def test_stale_code_is_not_restored(page, base_url):
    page.goto(base_url + 'tools/acls.html#timer')
    page.evaluate("""localStorage.setItem('acls-run', JSON.stringify({S: {t0: 1, cyc: null, last: {}, c: {shock: 2}, rhythm: 'AF'},
      cur: {}, ov: {}, scen: 'vf', visited: {}, log: ['舊的'], at: Date.now() - 7 * 3600e3}))""")
    page.reload()
    assert log_lines(page) == []
    assert page.evaluate("localStorage.getItem('acls-run')") is None


def test_reset_needs_two_taps_during_code(page, base_url):
    page.goto(base_url + 'tools/acls.html#timer')
    page.click('#actions [data-a="start"]')
    page.click('#b-reset')
    assert len(log_lines(page)) == 1
    page.click('#b-reset')
    assert log_lines(page) == []
    assert page.evaluate("localStorage.getItem('acls-run')") is None


def test_acls_run_is_never_synced(page, base_url):
    from conftest import MOCK_CLOUD
    page.add_init_script(MOCK_CLOUD)
    page.goto(base_url + 'index.html#acls')
    page.wait_for_timeout(2500)
    page.frame_locator('#f-acls').locator('#actions [data-a="start"]').first.click()
    page.wait_for_timeout(4500)
    keys = page.evaluate("Object.keys(__store).map(id => new TextDecoder().decode(new Uint8Array(id.slice(1).match(/../g).map(h => parseInt(h, 16)))))")
    assert 'acls-run' not in keys
