#!/usr/bin/env python3
"""把 shared/hub-common.css（共用設計基底）寫進 site/ 底下每個 HTML 的 <style id="hub-base">。

每個工具都要能單獨打開，所以共用樣式是「內嵌」在每個檔案裡的；正本只有 shared/hub-common.css 一份。
<style id="hub-base"> 裡分兩段：
  /*hub-common:start*/ … /*hub-common:end*/   ← 這支腳本整段換掉
  後面是那個工具自己的對應層（把工具自己的變數名對到 --hub-*），腳本不動

用法：python3 scripts/sync_shared.py          # 寫入
      python3 scripts/sync_shared.py --check  # 只檢查有沒有不同步（check.py 會呼叫）
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
START, END = '/*hub-common:start*/', '/*hub-common:end*/'
BLOCK = re.compile(re.escape(START) + r'.*?' + re.escape(END), re.S)
# 第一次搬移用：舊版沒有標記，共用段落是從 <style id="hub-base"> 到 reduced-motion 那一行
LEGACY = re.compile(r'(<style id="hub-base">)\n?.*?@media \(prefers-reduced-motion:reduce\)\{[^\n]*\n', re.S)


def files():
    return [SITE / 'index.html'] + sorted((SITE / 'tools').glob('*.html'))


def render(html, css):
    block = START + '\n' + css.rstrip('\n') + '\n' + END
    if START in html:
        return BLOCK.sub(lambda m: block, html, count=1)
    if not LEGACY.search(html):
        raise SystemExit('找不到 <style id="hub-base">')
    return LEGACY.sub(lambda m: m.group(1) + block + '\n', html, count=1)


def main():
    css = (ROOT / 'shared' / 'hub-common.css').read_text(encoding='utf8')
    check = '--check' in sys.argv
    stale = []
    for f in files():
        old = f.read_text(encoding='utf8')
        new = render(old, css)
        if new != old:
            stale.append(f.relative_to(ROOT))
            if not check:
                f.write_text(new, encoding='utf8')
    if check and stale:
        print('✗ 共用樣式沒同步（跑 python3 scripts/sync_shared.py）：' + '、'.join(map(str, stale)))
        sys.exit(1)
    print('✓ 共用樣式一致' if check else f'✓ 已同步 {len(stale)} 個檔案')


if __name__ == '__main__':
    main()
