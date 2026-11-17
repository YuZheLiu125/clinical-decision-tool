"""測試共用：用本機 HTTP 伺服器開 site/，Playwright（Chromium）跑真的瀏覽器。

每個測試一個全新的瀏覽器 context，所以 localStorage 互不影響。
mock_cloud：假的 claude.use('db') / claude.use('user')，用來測雲端同步，不需要連 claude.ai。
"""
import functools
import http.server
import pathlib
import threading

import pytest
from playwright.sync_api import sync_playwright

SITE = pathlib.Path(__file__).resolve().parent.parent / 'site'

MOCK_CLOUD = """
(() => {
  const store = {}; window.__store = store;
  window.__enc = k => 'k' + Array.from(new TextEncoder().encode(k), b => b.toString(16).padStart(2, '0')).join('');
  const col = {
    get: async () => ({ docs: Object.entries(store).map(([id, d]) => ({ id, exists: true, data: () => d })) }),
    doc: id => ({ set: async d => { store[id] = d; }, delete: async () => { delete store[id]; } }),
  };
  window.claude = { use: async n => n === 'db' ? { collection: () => col } : { id: async () => 'test-user' } };
})();
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


@pytest.fixture(scope='session')
def base_url():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{srv.server_address[1]}/'
    srv.shutdown()


@pytest.fixture(scope='session')
def pw():
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope='session')
def browser(pw):
    b = pw.chromium.launch()
    yield b
    b.close()


@pytest.fixture
def page(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    yield pg
    ctx.close()


@pytest.fixture
def phone(browser):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    yield pg
    ctx.close()


@pytest.fixture
def android(browser):
    """Android 手機（Pixel 7 的 Chrome）：Chromium 引擎＋Android 的 user agent、觸控、螢幕大小。"""
    ctx = browser.new_context(
        viewport={'width': 412, 'height': 839}, device_scale_factor=2.625, has_touch=True, is_mobile=True,
        user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36')
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    yield pg
    ctx.close()


@pytest.fixture(scope='session')
def webkit_browser(pw):
    """Safari 的引擎（WebKit）：iPhone、iPad 上所有瀏覽器都是它。沒裝就跳過（python3 -m playwright install webkit）。"""
    try:
        b = pw.webkit.launch()
    except Exception as e:   # noqa: BLE001
        pytest.skip(f'沒有安裝 WebKit：{e}')
    yield b
    b.close()


@pytest.fixture
def iphone(webkit_browser):
    ctx = webkit_browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, has_touch=True, is_mobile=True,
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    yield pg
    ctx.close()
