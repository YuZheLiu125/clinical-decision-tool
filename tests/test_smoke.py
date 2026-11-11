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
