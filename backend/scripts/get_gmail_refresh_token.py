"""One-time helper: turn a Gmail OAuth Client ID + Secret into a refresh token.

Run locally (not on Render):
    python scripts/get_gmail_refresh_token.py

It will open your browser to sign in as hello.vanceco@gmail.com and grant
"send email" permission, then print a GMAIL_REFRESH_TOKEN value to paste
into your .env / Render env vars. Client ID + Secret come from the OAuth
"Desktop app" credential created in Google Cloud Console.
"""

import http.server
import urllib.parse
import webbrowser

import requests

REDIRECT_PORT = 8766
REDIRECT_URI = f"http://localhost:{REDIRECT_PORT}/"
SCOPE = "https://www.googleapis.com/auth/gmail.send"

_captured_code = {}


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        _captured_code["code"] = params.get("code", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<html><body>Done &mdash; you can close this tab and return to the terminal.</body></html>")

    def log_message(self, *args):
        pass  # silence default request logging


def main() -> None:
    client_id = input("Client ID: ").strip()
    client_secret = input("Client Secret: ").strip()

    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    })

    print(f"\nOpening browser to authorize as hello.vanceco@gmail.com...\nIf it doesn't open, visit:\n{auth_url}\n")
    webbrowser.open(auth_url)

    server = http.server.HTTPServer(("localhost", REDIRECT_PORT), _CallbackHandler)
    server.handle_request()  # blocks until the one callback request lands

    code = _captured_code.get("code")
    if not code:
        print("No authorization code received — did you approve the consent screen?")
        return

    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    refresh_token = data.get("refresh_token")

    if not refresh_token:
        print("No refresh_token in response — this can happen if you'd already authorized before.")
        print("Fix: revoke access at https://myaccount.google.com/permissions and re-run this script.")
        print(f"Raw response: {data}")
        return

    print("\nSuccess. Add these to your .env / Render env vars:\n")
    print(f"GMAIL_CLIENT_ID={client_id}")
    print(f"GMAIL_CLIENT_SECRET={client_secret}")
    print(f"GMAIL_REFRESH_TOKEN={refresh_token}")


if __name__ == "__main__":
    main()
