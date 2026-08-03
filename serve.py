#!/usr/bin/env python3
"""Static server with correct MIME types for ES modules (fixes Windows text/plain)."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
import os
import sys

# Force correct types regardless of Windows registry
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("font/woff2", ".woff2")


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, "extensions_map", {}),
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".svg": "image/svg+xml",
        "": "application/octet-stream",
    }

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving {os.getcwd()}")
    print(f"Open http://127.0.0.1:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
