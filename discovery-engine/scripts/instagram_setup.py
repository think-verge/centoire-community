"""Connect Instagram: turn a Graph API Explorer token into a saved, long-lived token.

    python -m scripts.instagram_setup                    # exchange token, find IG account, save to .env
    python -m scripts.instagram_setup --system-user      # paste a non-expiring System User token instead
    python -m scripts.instagram_setup --check-watchlist  # verify every handle in instagram.yaml

Needs META_APP_ID and META_APP_SECRET in .env. The token you paste is read with a
hidden prompt (never echoed or stored); only the long-lived token is written to .env.
Nothing secret is printed. See docs/instagram-setup.md for the full walkthrough.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import set_key

from app.config import REPO_ROOT, get_settings
from app.sources import load_instagram

ENV_FILE = REPO_ROOT / ".env"


def _get(client: httpx.Client, base: str, path: str, params: dict) -> dict:
    try:
        resp = client.get(f"{base}/{path}", params=params)
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        sys.exit(f"Request to Meta failed: {type(exc).__name__}")
    if "error" in data:
        err = data["error"]
        sys.exit(f"Meta returned an error [{err.get('code')}]: {err.get('message')}")
    return data


def setup(system_user: bool) -> None:
    settings = get_settings()
    base = f"https://graph.facebook.com/{settings.meta_graph_version}"
    app_id, app_secret = os.getenv("META_APP_ID"), os.getenv("META_APP_SECRET")
    if not system_user and not (app_id and app_secret):
        sys.exit("Add META_APP_ID and META_APP_SECRET to .env first (App settings → Basic).")

    prompt = ("Paste the System User token: " if system_user
              else "Paste the user token from Graph API Explorer: ")
    token = getpass.getpass(prompt).strip()
    if not token:
        sys.exit("No token entered.")

    with httpx.Client(timeout=30) as client:
        expires_at = None
        if not system_user:
            exchanged = _get(client, base, "oauth/access_token", {
                "grant_type": "fb_exchange_token", "client_id": app_id,
                "client_secret": app_secret, "fb_exchange_token": token,
            })
            token = exchanged["access_token"]
            if exchanged.get("expires_in"):
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(exchanged["expires_in"]))
            print("✓ Exchanged for a long-lived token"
                  + (f" (expires {expires_at:%Y-%m-%d})" if expires_at else ""))

        pages = _get(client, base, "me/accounts", {
            "fields": "id,name,instagram_business_account{id,username}", "access_token": token,
        }).get("data", [])
        linked = [p for p in pages if p.get("instagram_business_account")]
        if not linked:
            names = ", ".join(p.get("name", "?") for p in pages) or "none"
            sys.exit("No Facebook Page with a linked Instagram professional account was found "
                     f"(Pages this token can see: {names}). Link the Instagram account to the "
                     "Page, and grant pages_show_list when generating the token.")
        if len(linked) > 1:
            for i, p in enumerate(linked, 1):
                print(f"  {i}. {p['name']} → @{p['instagram_business_account'].get('username')}")
            choice = linked[int(input("Which one should the engine use? ")) - 1]
        else:
            choice = linked[0]
        ig = choice["instagram_business_account"]
        print(f"✓ Found Instagram account @{ig.get('username')} (Page: {choice['name']})")

        probe = _get(client, base, ig["id"], {
            "fields": "business_discovery.username(nike){username,followers_count}",
            "access_token": token,
        })
        followers = (probe.get("business_discovery") or {}).get("followers_count")
        print(f"✓ Test read of @nike worked ({followers:,} followers)" if followers
              else "✓ Test read worked")

    ENV_FILE.touch(exist_ok=True)
    set_key(str(ENV_FILE), "IG_USER_ID", ig["id"])
    set_key(str(ENV_FILE), "IG_ACCESS_TOKEN", token)
    set_key(str(ENV_FILE), "IG_TOKEN_EXPIRES_AT", expires_at.isoformat() if expires_at else "never")
    print(f"✓ Saved IG_USER_ID, IG_ACCESS_TOKEN and IG_TOKEN_EXPIRES_AT to {ENV_FILE.name}")
    print("Next: python -m scripts.instagram_setup --check-watchlist, then restart the engine.")


def check_watchlist() -> None:
    settings = get_settings()
    if not (settings.ig_user_id and settings.ig_access_token):
        sys.exit("Instagram isn't connected yet: run `python -m scripts.instagram_setup` first.")
    accounts = load_instagram(settings.instagram_file)
    base = f"https://graph.facebook.com/{settings.meta_graph_version}"
    print(f"Checking {len(accounts)} handles (uses {len(accounts)} API calls)…")
    bad = []
    with httpx.Client(timeout=30) as client:
        for s in accounts:
            try:
                data = client.get(f"{base}/{settings.ig_user_id}", params={
                    "fields": f"business_discovery.username({s.handle}){{username,followers_count,media_count}}",
                    "access_token": settings.ig_access_token,
                }).json()
            except (httpx.HTTPError, ValueError) as exc:
                data = {"error": {"message": type(exc).__name__}}
            if "error" in data:
                err = data["error"]
                bad.append(s.handle)
                print(f"  ✗ @{s.handle:<24} [{err.get('code')}] {str(err.get('message'))[:90]}")
                if err.get("code") in {4, 17, 32, 613}:
                    sys.exit("Rate limited by Meta. Wait an hour and run again.")
            else:
                bd = data.get("business_discovery") or {}
                print(f"  ✓ @{s.handle:<24} {bd.get('followers_count', 0):>12,} followers  "
                      f"{bd.get('media_count', 0):>6,} posts")
            time.sleep(1)
    print(f"\n{len(accounts) - len(bad)} ok, {len(bad)} to fix or remove in instagram.yaml: "
          + (", ".join(bad) or "none"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-watchlist", action="store_true")
    parser.add_argument("--system-user", action="store_true")
    args = parser.parse_args()
    check_watchlist() if args.check_watchlist else setup(args.system_user)
