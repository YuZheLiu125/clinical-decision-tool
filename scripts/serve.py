#!/usr/bin/env python3
"""本機預覽用的伺服器：跟 python -m http.server 一樣，但不讓瀏覽器快取（改了檔案重新整理就看得到）。

用法：python3 scripts/serve.py [port]   （預設 8793，~/.claude/launch.json 的 cdt-site 用這支）
"""
import functools
import http.server
import pathlib
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent / 'site'


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8793
    http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoCache, directory=str(SITE))).serve_forever()
