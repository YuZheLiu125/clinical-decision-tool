"""待辦表（shiftboard.v1）的狀態轉換，以及其他工具透過 hubTodo 對待辦表的連結。"""
import json

import pytest


def board(pg):
    return json.loads(pg.evaluate("localStorage.getItem('shiftboard.v1')"))


def seed(pg, items, done=()):
    pg.evaluate("([i, d]) => localStorage.setItem('shiftboard.v1', JSON.stringify({items: i, done: d}))", [list(items), list(done)])


def rep_item(now_ms=None):
    return {'id': 'r1', 'bed': '5', 'text': 'finger sugar', 'p': 2, 'due': 9e12, 'start': 0, 'rep': 3, 'iv': 60,
            'subs': [{'id': f'r1.{k}', 't': t, 'tag': '', 'd': 0} for k, t in enumerate('abc')]}


def test_repeat_done_then_undo_does_not_duplicate(page, base_url):
    page.goto(base_url + 'tools/todo.html')
    seed(page, [rep_item()])
    page.reload()
    page.click('[data-id="r1"] [data-a="done"]')
    st = board(page)
    assert len(st['items']) == 1 and st['items'][0]['rep'] == 2   # 下一次已排好
    assert st['done'][0]['nx'] == st['items'][0]['id']
    page.evaluate("document.querySelector('[data-undo]').click()")
    st = board(page)
    assert [(i['id'], i['rep']) for i in st['items']] == [('r1', 3)]
    assert st['done'] == []


def test_save_keeps_items_added_by_other_tools(page, base_url):
    page.goto(base_url + 'tools/todo.html')
    seed(page, [rep_item()])
    page.reload()
    # 模擬會診稿在背景寫入一項，待辦表還沒收到 storage 事件就存檔
    page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('shiftboard.v1'));
      s.items.push({id: 'ext', bed: '', text: '等心臟科回電', p: 2, due: 0, start: 1}); localStorage.setItem('shiftboard.v1', JSON.stringify(s)); }""")
    page.click('[data-id="r1"] [data-a="up"]')
    assert any(i['id'] == 'ext' for i in board(page)['items'])


def test_deleted_item_is_not_brought_back(page, base_url):
    page.goto(base_url + 'tools/todo.html')
    seed(page, [rep_item(), {'id': 'x', 'bed': '', 'text': 'x', 'p': 3, 'due': 0, 'start': 1}])
    page.reload()
    page.click('[data-id="x"] [data-a="del"]')
    page.click('[data-id="x"] [data-a="del"]')   # 第二下確認
    page.click('[data-id="r1"] [data-a="up"]')   # 再觸發一次存檔
    assert [i['id'] for i in board(page)['items']] == ['r1']


def test_delete_needs_two_taps(page, base_url):
    page.goto(base_url + 'tools/todo.html')
    seed(page, [rep_item()])
    page.reload()
    page.click('[data-id="r1"] [data-a="del"]')
    assert len(board(page)['items']) == 1
    assert page.text_content('[data-id="r1"] [data-a="del"]') == '確定刪除'


@pytest.mark.parametrize('tool', ['copilot', 'consult', 'meds'])
def test_hubtodo_subitems_follow_id_not_position(page, base_url, tool):
    """待辦表刪掉第 0 個子項目後，工具查第 1、2 個子項目仍要對到原本那一項。"""
    page.goto(base_url + f'tools/{tool}.html')
    item = rep_item()
    item['subs'] = [s for s in item['subs'] if s['id'] != 'r1.0']
    seed(page, [item])
    assert page.evaluate("hubTodo.subStatus('r1', 0)") is None
    assert page.evaluate("hubTodo.subStatus('r1', 1)") == 'open'
    assert page.evaluate("hubTodo.subDone('r1', 2)") is True
    subs = board(page)['items'][0]['subs']
    assert {s['id']: s['d'] for s in subs} == {'r1.1': 0, 'r1.2': 1}


def test_hubtodo_add_and_complete(page, base_url):
    page.goto(base_url + 'tools/copilot.html')
    seed(page, [])
    tid = page.evaluate("hubTodo.add({bed: '12', text: '發燒', p: 2, src: '主訴處理', subs: [{t: 'CBC'}, {t: 'CXR'}]})")
    assert page.evaluate(f"hubTodo.status('{tid}')") == 'open'
    assert page.evaluate(f"hubTodo.complete('{tid}')") is True
    assert page.evaluate(f"hubTodo.status('{tid}')") == 'done'
    assert page.evaluate(f"hubTodo.subStatus('{tid}', 0)") == 'done'
