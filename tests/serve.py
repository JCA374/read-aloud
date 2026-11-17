# The test pages (tests/site) on port 8799, with caching switched off: test profiles are kept between runs,
# and a browser that cached a test page would keep testing the old version after the page changed.
import functools, http.server, os
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a): pass
site = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
http.server.ThreadingHTTPServer(("", 8799), functools.partial(NoCache, directory=site)).serve_forever()
