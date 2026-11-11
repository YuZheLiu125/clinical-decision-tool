"""總站雲端同步：用假的雲端（conftest.MOCK_CLOUD）測。

- 雲端有新資料時，工具就地更新、不整頁重載
- 本機有還沒上傳的修改、雲端也被別台改過：待辦表逐項合併；其他資料用雲端的、本機留備份
- 工具重載後，右下角待辦按鈕不會卡在隱藏
"""
import json

import pytest
from conftest import MOCK_CLOUD


@pytest.fixture
def hub(page, base_url):
    page.add_init_script(MOCK_CLOUD)
    page.goto(base_url + 'index.html#rounds')
    page.wait_for_timeout(4500)
    assert page.evaluate("document.getElementById('sync').dataset.s") == 'ok'
    return page


def remote(pg, key, value):
    pg.evaluate("([k, v]) => { __store[__enc(k)] = {t: Date.now() + 1e6, v}; }", [key, value])


def foreground(pg):
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(3000)


def test_remote_change_updates_in_place(hub):
    hub.evaluate("document.getElementById('f-rounds').contentWindow.__alive = 1")
    remote(hub, 'shiftboard.v1', json.dumps({'items': [{'id': 'R', 'text': '別台加的', 'p': 3, 'due': 0, 'start': 1}], 'done': []}))
    foreground(hub)
    assert hub.evaluate("document.getElementById('f-rounds').contentWindow.__alive") == 1   # 查房板沒被重載
    texts = hub.evaluate("[...document.getElementById('f-todo').contentDocument.querySelectorAll('.item .text')].map(e => e.textContent)")
    assert texts == ['別台加的']
    assert hub.errors == []


def test_conflict_merges_todo_items(hub):
    hub.evaluate("localStorage.setItem('shiftboard.v1', JSON.stringify({items: [{id: 'L', text: '本機', p: 3, due: 0, start: 1}, {id: 'B', text: '兩邊都有', p: 3, due: 0, start: 1}], done: []}))")
    remote(hub, 'shiftboard.v1', json.dumps({'items': [{'id': 'R', 'text': '雲端', 'p': 3, 'due': 0, 'start': 1}],
                                             'done': [{'id': 'B', 'text': '兩邊都有', 'p': 3, 'due': 0, 'start': 1, 'doneAt': 2}]}))
    foreground(hub)
    st = json.loads(hub.evaluate("localStorage.getItem('shiftboard.v1')"))
    assert sorted(i['id'] for i in st['items']) == ['L', 'R']   # 兩邊加的都留著
    assert [i['id'] for i in st['done']] == ['B']                # 任一邊完成就算完成


def test_conflict_on_other_data_keeps_backup(hub):
    hub.evaluate("localStorage.setItem('rounds.v1', JSON.stringify({beds: [{id: 'b1', bed: '7'}]}))")
    remote(hub, 'rounds.v1', json.dumps({'beds': [{'id': 'b2', 'bed': '9'}]}))
    foreground(hub)
    assert json.loads(hub.evaluate("localStorage.getItem('rounds.v1')"))['beds'][0]['bed'] == '9'
    assert json.loads(hub.evaluate("localStorage.getItem('hub.sync.bak:rounds.v1')"))['beds'][0]['bed'] == '7'


def test_unchanged_local_just_takes_remote(hub):
    hub.wait_for_timeout(3500)  # 等本機資料都上傳，指紋一致
    remote(hub, 'hub.lastBed', '23')
    foreground(hub)
    assert hub.evaluate("localStorage.getItem('hub.lastBed')") == '23'
    assert hub.evaluate("localStorage.getItem('hub.sync.bak:hub.lastBed')") is None


def test_fab_unhides_after_tool_reload(phone, base_url):
    phone.goto(base_url + 'index.html#meds')
    phone.wait_for_timeout(1500)
    phone.evaluate("window.postMessage({hub: 'sheet', open: true}, '*')")
    phone.evaluate("document.querySelector('#tab-pilot').click()")
    phone.wait_for_timeout(1200)
    assert 'gl-open' in phone.evaluate("document.body.className")
    phone.evaluate("document.getElementById('f-pilot').contentWindow.location.reload()")
    phone.wait_for_timeout(1500)
    assert 'gl-open' not in phone.evaluate("document.body.className")
