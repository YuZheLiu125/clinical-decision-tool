#!/usr/bin/env python3
"""靜態檢查：不用開瀏覽器，幾秒內跑完。

1. 每個 HTML 裡的 inline <script> 都能被 node 解析（抓語法錯誤）
2. 總站 index.html 裡 data-src 指到的工具檔案都存在
3. 版本號一致：VERSION 檔 = index.html 的 <meta name="app-version">
4. 每個 HTML 內嵌的共用樣式跟 shared/hub-common.css 一致

用法：python3 scripts/check.py
"""
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
SCRIPT_RE = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.S)


def syntax_errors():
    errs = []
    for f in sorted(SITE.rglob('*.html')):
        html = f.read_text(encoding='utf8')
        for i, js in enumerate(SCRIPT_RE.findall(html)):
            with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf8') as t:
                t.write(js)
            r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True)
            pathlib.Path(t.name).unlink()
            if r.returncode:
                msg = r.stderr.strip().splitlines()
                errs.append(f'{f.relative_to(ROOT)} 第 {i + 1} 段 <script>：' + ' / '.join(msg[1:4]))
    return errs


def missing_files():
    html = (SITE / 'index.html').read_text(encoding='utf8')
    return [f'index.html 指到不存在的檔案：{p}' for p in re.findall(r"\bsrc: '(tools/[^']+)'", html) + re.findall(r'data-src="(tools/[^"]+)"', html)
            if not (SITE / p).exists()]


def version_mismatch():
    v = (ROOT / 'VERSION').read_text().strip()
    m = re.search(r'<meta name="app-version" content="([^"]*)">', (SITE / 'index.html').read_text(encoding='utf8'))
    if not m:
        return ['index.html 沒有 <meta name="app-version">']
    return [] if m.group(1) == v else [f'版本號不一致：VERSION={v}，index.html={m.group(1)}']


def shared_out_of_sync():
    r = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'sync_shared.py'), '--check'], capture_output=True, text=True)
    return [] if r.returncode == 0 else [r.stdout.strip().lstrip('✗ ')]


def main():
    errs = syntax_errors() + missing_files() + version_mismatch() + shared_out_of_sync()
    for e in errs:
        print('✗', e)
    if errs:
        sys.exit(1)
    print('✓ 靜態檢查通過')


if __name__ == '__main__':
    main()
