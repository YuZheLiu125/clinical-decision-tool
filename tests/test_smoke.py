"""煙霧測試：每個工具單獨打開、總站在電腦與手機版面打開，都不能有 JavaScript 錯誤。"""
import pytest

TOOLS = ['acls', 'consult', 'copilot', 'labs', 'meds', 'rounds', 'todo']


@pytest.mark.parametrize('tool', TOOLS)
def test_tool_opens_without_errors(page, base_url, tool):
    page.goto(base_url + f'tools/{tool}.html')
    page.wait_for_timeout(500)
    assert page.errors == []


def test_hub_loads_all_tools_desktop(page, base_url):
    page.goto(base_url + 'index.html')
    page.wait_for_timeout(4000)  # 其他工具在畫面閒下來時才一個一個載
    loaded = page.evaluate("[...document.querySelectorAll('.pane iframe')].filter(f => f.getAttribute('src')).length")
    assert loaded == 7
    assert page.evaluate("document.getElementById('sync').dataset.s") == 'local'  # 沒有登入 → 只存本機
    assert page.errors == []


def test_hub_shows_version(page, base_url):
    import pathlib
    v = (pathlib.Path(__file__).resolve().parent.parent / 'VERSION').read_text().strip()
    page.goto(base_url + 'index.html')
    assert page.text_content('#pane-todo .sig') == f'by 劉宇哲 · v{v}'


def test_hub_phone_tabs_and_drawer(phone, base_url):
    phone.goto(base_url + 'index.html')
    phone.wait_for_timeout(800)
    phone.click('#tab-rounds')
    phone.wait_for_timeout(800)
    assert phone.get_attribute('#tab-rounds', 'aria-selected') == 'true'
    phone.click('#fab')
    assert 'open' in phone.get_attribute('#pane-todo', 'class')
    phone.click('#todoClose')
    assert 'open' not in phone.get_attribute('#pane-todo', 'class')
    assert phone.errors == []


def test_tool_that_fails_to_load_retries_itself(phone, base_url):
    """工具第一次載入失敗（網路斷一下）：自動重載，不會停在空白。"""
    n = {'c': 0}
    def flaky(route):
        n['c'] += 1
        route.abort() if n['c'] == 1 else route.continue_()
    phone.route('**/tools/meds.html', flaky)
    phone.goto(base_url + 'index.html#meds')
    phone.wait_for_timeout(3000)
    assert n['c'] >= 2
    assert phone.evaluate("document.getElementById('f-meds').contentDocument.body.innerText.length") > 100
    assert phone.locator('#pane-meds .reload').count() == 0 or not phone.locator('#pane-meds .reload').is_visible()


def test_tool_that_keeps_failing_shows_reload_button(phone, base_url):
    phone.route('**/tools/consult.html', lambda r: r.abort())
    phone.goto(base_url + 'index.html#consult')
    phone.wait_for_timeout(3000)
    btn = phone.locator('#pane-consult .reload')
    assert btn.is_visible()
    phone.unroute('**/tools/consult.html')
    btn.click()
    phone.wait_for_timeout(2000)
    assert phone.evaluate("document.getElementById('f-consult').contentDocument.body.innerText.length") > 100
    assert not btn.is_visible()


def test_tool_emptied_in_background_comes_back(phone, base_url):
    """iOS 在背景把工具回收（變成空白）：回到前景時自動重載。"""
    phone.goto(base_url + 'index.html#meds')
    phone.wait_for_timeout(2500)
    phone.evaluate("document.getElementById('f-meds').contentDocument.body.replaceChildren()")
    phone.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    phone.wait_for_timeout(2000)
    assert phone.evaluate("document.getElementById('f-meds').contentDocument.body.innerText.length") > 100
