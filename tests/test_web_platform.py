"""網頁平台基本功：語言標記、注音選字的 Enter、訊息來源檢查、複製失敗要講、提示要讓報讀軟體念得到、輸入框的焦點框。"""
import pytest

PAGES = ['index.html'] + [f'tools/{t}.html' for t in ['acls', 'consult', 'copilot', 'labs', 'meds', 'rounds', 'todo']]


@pytest.mark.parametrize('path', PAGES)
def test_page_declares_traditional_chinese(page, base_url, path):
    page.goto(base_url + path)
    assert page.evaluate('document.documentElement.lang') == 'zh-Hant'


def test_rounds_enter_while_composing_does_not_submit(page, base_url):
    """Safari 選字確認的那個 Enter，isComposing 已經是 false，只剩 keyCode 229 認得出來。"""
    page.goto(base_url + 'tools/rounds.html')
    page.wait_for_timeout(300)
    n = page.evaluate("""() => {
      let n = 0;
      const b = document.createElement('button'); b.dataset.act = 'pAddFree';
      b.addEventListener('click', e => { e.stopPropagation(); n++; });
      const i = document.createElement('input'); i.id = 'pFree';
      document.body.append(b, i);
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true }));
      const during = n;
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
      b.remove(); i.remove();
      return [during, n];
    }""")
    assert n == [0, 1]


def test_hub_ignores_todo_add_not_from_a_tool(page, base_url):
    page.goto(base_url + 'index.html')
    page.wait_for_timeout(1500)
    page.evaluate("window.postMessage({ hub: 'todo-add', id: 'zz', text: '假的', bed: '', n: 0 }, '*')")
    page.wait_for_timeout(300)
    assert page.locator('.hub-toast').count() == 0
    # 真的從工具來的照常顯示
    page.evaluate("""() => {
      const f = [...document.querySelectorAll('.pane iframe')].find(f => f.getAttribute('src') && f.contentWindow.document.readyState === 'complete');
      f.contentWindow.eval("parent.postMessage({ hub: 'todo-add', id: 'zz', text: '真的', bed: '', n: 0 }, '*')");
    }""")
    page.wait_for_timeout(300)
    assert page.locator('.hub-toast').count() == 1
    assert page.errors == []


def test_rounds_copy_failure_is_reported(page, base_url):
    page.goto(base_url + 'tools/rounds.html')
    page.wait_for_timeout(300)
    page.evaluate("""() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true });
      document.execCommand = () => false;
      const b = document.createElement('button'); b.dataset.act = 'copyLearn'; document.body.append(b); b.click(); b.remove();
    }""")
    page.wait_for_timeout(300)
    assert '複製失敗' in page.text_content('.toast')


def test_toasts_are_status_regions(page, base_url):
    page.goto(base_url + 'tools/meds.html')
    page.wait_for_timeout(300)
    page.evaluate("hubToast('測試')")
    assert page.get_attribute('.hub-toast', 'role') == 'status'
    page.goto(base_url + 'tools/copilot.html')
    assert page.get_attribute('#toast', 'role') == 'status'
    page.goto(base_url + 'tools/todo.html')
    page.wait_for_timeout(300)
    page.fill('#task', '測試提示')
    page.keyboard.press('Enter')
    page.wait_for_timeout(200)
    if page.locator('.toast').count():
        assert page.get_attribute('.toast', 'role') == 'status'
    import pathlib
    src = (pathlib.Path(__file__).resolve().parent.parent / 'site/tools/todo.html').read_text(encoding='utf8')
    assert "toastEl.setAttribute('role', 'status')" in src


@pytest.mark.parametrize('tool,sel', [('labs', '.row1 input'), ('meds', '.search input')])
def test_search_field_keeps_a_focus_ring(page, base_url, tool, sel):
    page.goto(base_url + f'tools/{tool}.html')
    page.wait_for_timeout(300)
    page.focus(sel)
    assert page.evaluate(f"getComputedStyle(document.querySelector('{sel}')).outlineStyle") != 'none'
