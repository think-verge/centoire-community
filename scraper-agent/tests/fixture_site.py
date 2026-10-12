"""A tiny local website that behaves like a paid news site, for browser tests."""

from __future__ import annotations

import threading
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

from helpers import LONG_PARAGRAPH

USER, PASSWORD = "reader@example.com", "Sup3r-secret-pw!"


class SiteState:
    def __init__(self) -> None:
        self.sessions: set[str] = set()
        self.layout = "v1"  # "v2" renames every class, like a redesign
        self.force_teaser = False  # logged-in users still get the teaser (session silently dead)
        self.captcha_login = False
        self.open_access = False  # everyone sees full articles (a free site)
        self.login_posts = 0
        self.robots = "User-agent: *\nAllow: /\n"
        self.hits: list[str] = []


def make_handler(state: SiteState):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # keep test output quiet
            pass

        def _session_ok(self) -> bool:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            return "session" in cookie and cookie["session"].value in state.sessions

        def _send(self, body: str, status: int = 200, headers: dict | None = None, ctype: str = "text/html; charset=utf-8"):
            data = body.encode()
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):  # noqa: N802
            path = self.path.split("?")[0]
            state.hits.append(path)
            if path == "/robots.txt":
                return self._send(state.robots, ctype="text/plain")
            logged_in = self._session_ok()
            if path == "/":
                nav = '<nav class="account">Account</nav>' if logged_in else '<a class="signin" href="/login">Sign in</a>'
                return self._send(f"<html><body>{nav}<h1>Daily Thread</h1><a href=\"/latest\">Latest news</a></body></html>")
            if path == "/login":
                captcha = '<iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe>' if state.captcha_login else ""
                return self._send(
                    '<html><body><form method="post" action="/login"><input id="email" name="email"><input id="password" name="password" type="password">'
                    f'<button id="signin" type="submit">Sign in</button>{captcha}</form></body></html>'
                )
            if path == "/latest":
                if state.layout == "v2":
                    cards = "".join(f'<div class="tile"><a class="t" href="/story/{i}">Story {i}</a></div>' for i in range(1, 5))
                else:
                    cards = "".join(f'<article class="card"><a href="/story/{i}"><h2>Story {i}</h2></a></article>' for i in range(1, 5))
                return self._send(f"<html><body>{cards}</body></html>")
            if path.startswith("/story/"):
                n = path.rsplit("/", 1)[1]
                if (logged_in or state.open_access) and not state.force_teaser:
                    body = "".join(f"<p>{LONG_PARAGRAPH}</p>" for _ in range(2))
                    return self._send(
                        f'<html><head><meta property="og:image" content="/img/{n}.jpg"></head><body><h1>Story {n}</h1><span class="byline">By Ada</span>'
                        f'<time datetime="2026-10-0{n}T08:00:00Z"></time><div class="body">{body}<div class="ad">BUY NOW</div></div></body></html>'
                    )
                return self._send(
                    f'<html><body><h1>Story {n}</h1><div class="body"><p>Only a short teaser of the story.</p></div>'
                    '<div class="paywall">Subscribe to keep reading</div></body></html>'
                )
            self._send("not found", 404)

        def do_POST(self):  # noqa: N802
            if self.path != "/login":
                return self._send("not found", 404)
            state.login_posts += 1
            length = int(self.headers.get("Content-Length", 0))
            form = parse_qs(self.rfile.read(length).decode())
            if form.get("email", [""])[0] == USER and form.get("password", [""])[0] == PASSWORD:
                token = f"tok{len(state.sessions) + 1}-{state.login_posts}"
                state.sessions.add(token)
                return self._send("", 302, {"Location": "/", "Set-Cookie": f"session={token}; Path=/; HttpOnly"})
            self._send('<html><body><p class="error">Wrong email or password</p></body></html>')

    return Handler


class Site:
    def __init__(self) -> None:
        self.state = SiteState()
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.state))
        self.url = f"http://127.0.0.1:{self._server.server_port}"
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    def start(self) -> Site:
        self._thread.start()
        return self

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()
