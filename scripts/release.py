#!/usr/bin/env python3
"""一鍵發布（repo 是唯一正本）。

用法：
  python3 scripts/release.py patch|minor|major     # 準備發布
  python3 scripts/release.py record <artifact 版本>  # 發布到 claude.ai 之後，記下對應的 artifact 版本

「準備發布」會依序：
  1. 確認工作區乾淨、CHANGELOG 的「未發布」區有內容
  2. 跑靜態檢查與所有測試，任何一項失敗就停
  3. 版本號 +1（VERSION、index.html 的 app-version）
  4. CHANGELOG「未發布」→「[x.y.z] - 日期」
  5. commit、打 tag vX.Y.Z
  6. 寫 dist/publish.json：要發布到 claude.ai 的檔案清單（給 Claude 的 publish_files 用）

真正發布到 claude.ai 要由 Claude 用 Artifact 工具做（這台機器沒有 claude.ai 的發布權限），
發布完再跑 record，把 artifact 版本記進 RELEASES.md。

patch：修 bug、改字　minor：新功能、行為改變　major：資料格式不相容（例如 localStorage 結構改了）
"""
import datetime
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
SLUG = 'dd7bba5d-4f79-4d51-9ce8-bae6b37db5da'
TRAILER = '

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>'


def sh(*a, check=True):
    return subprocess.run(a, cwd=ROOT, check=check, capture_output=True, text=True).stdout.strip()


def die(msg):
    print('✗', msg)
    sys.exit(1)


def bump(v, part):
    ma, mi, pa = map(int, v.split('.'))
    return {'major': f'{ma + 1}.0.0', 'minor': f'{ma}.{mi + 1}.0', 'patch': f'{ma}.{mi}.{pa + 1}'}[part]


def prepare(part):
    if sh('git', 'status', '--porcelain'):
        die('工作區有還沒 commit 的修改，先 commit 再發布')
    cl = (ROOT / 'CHANGELOG.md').read_text(encoding='utf8')
    m = re.search(r'## \[未發布\]\n(.*?)(?=\n## \[)', cl, re.S)
    if not m or not m.group(1).strip():
        die('CHANGELOG.md 的「## [未發布]」是空的：先寫這次改了什麼')

    print('… 靜態檢查'); r = subprocess.run([sys.executable, 'scripts/check.py'], cwd=ROOT)
    if r.returncode: die('靜態檢查沒過')
    print('… 測試'); r = subprocess.run([sys.executable, '-m', 'pytest', '-q', 'tests'], cwd=ROOT)
    if r.returncode: die('測試沒過')

    old = (ROOT / 'VERSION').read_text().strip()
    new = bump(old, part)
    (ROOT / 'VERSION').write_text(new + '\n')
    idx = SITE / 'index.html'
    idx.write_text(re.sub(r'(<meta name="app-version" content=")[^"]*(">)', rf'\g<1>{new}\g<2>',
                          idx.read_text(encoding='utf8'), count=1), encoding='utf8')
    today = datetime.date.today().isoformat()
    cl = cl.replace('## [未發布]\n', f'## [未發布]\n\n## [{new}] - {today}\n', 1)
    (ROOT / 'CHANGELOG.md').write_text(cl, encoding='utf8')

    sh('git', 'add', '-A')
    sh('git', 'commit', '-m', f'v{new}' + TRAILER)
    sh('git', 'tag', '-a', f'v{new}', '-m', f'v{new}')

    dist = ROOT / 'dist'; dist.mkdir(exist_ok=True)
    files = [{'as': str(p.relative_to(SITE)), 'path': str(p)} for p in sorted(SITE.rglob('*')) if p.is_file()]
    (dist / 'publish.json').write_text(json.dumps({'slug': SLUG, 'version': new, 'files': files}, ensure_ascii=False, indent=2), encoding='utf8')
    print(f'✓ v{old} → v{new}，已 commit 並打 tag v{new}')
    print(f'  下一步：用 publish_files 發布 dist/publish.json 列的檔案，再跑 python3 scripts/release.py record <artifact 版本>')


def record(artifact_version):
    v = (ROOT / 'VERSION').read_text().strip()
    rel = ROOT / 'RELEASES.md'
    rows = rel.read_text(encoding='utf8') if rel.exists() else ''
    if f'| v{v} |' in rows:
        die(f'v{v} 已經記過了')
    when = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    rel.write_text(rows.rstrip('\n') + f'\n| v{v} | {artifact_version} | {when} | {sh("git", "rev-parse", "--short", "HEAD")} |\n', encoding='utf8')
    sh('git', 'add', 'RELEASES.md')
    sh('git', 'commit', '-m', f'記錄 v{v} 已發布（artifact {artifact_version}）' + TRAILER)
    print(f'✓ 已記錄 v{v} = artifact {artifact_version}')


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] in ('patch', 'minor', 'major'):
        prepare(sys.argv[1])
    elif len(sys.argv) == 3 and sys.argv[1] == 'record':
        record(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(2)
