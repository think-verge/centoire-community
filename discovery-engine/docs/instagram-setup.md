# Connecting Instagram

The engine reads public Instagram **Business/Creator** accounts through Meta's
*Instagram API with Facebook Login* ("business discovery"). You need four things:
an Instagram professional account, a Facebook Page linked to it, a Meta developer
app, and a token. Allow 30–60 minutes. Meta's screens change often; if a label below
differs, look for the closest equivalent.

## A. Instagram professional account

1. Log in to Centoire's Instagram account in the Instagram app.
2. Profile → ☰ menu → **Account type and tools** → **Switch to professional account**.
3. Choose **Business**, pick a category (e.g. *Media/news company*), finish the steps.

## B. Facebook Page, linked to the Instagram account

4. If Centoire has no Facebook Page: facebook.com/pages/create → create one. You must be its admin.
5. Link Instagram to the Page, either:
   - Facebook Page → **Settings** → **Linked accounts** → **Instagram** → **Connect**, or
   - **Meta Business Suite** (business.facebook.com) → **Settings** → **Instagram accounts** → **Connect**.

## C. Meta developer app

6. Go to **developers.facebook.com** → **Get started** and register as a developer
   with the Facebook account that admins the Page.
7. **My Apps** → **Create app**. If asked for a use case, choose **Other**, then app type
   **Business**. Name it e.g. *Centoire Discovery*.
8. In the app dashboard, **Add product**:
   - **Instagram** → choose **API setup with Facebook login** (not "Instagram login").
   - **Facebook Login for Business**.
9. **App settings → Basic**: copy the **App ID** and **App Secret** into
   `Discovery-Engine/.env` yourself:
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   ```
   Don't paste these into chat or commit them.
10. Leave the app in **Development mode**. You're an admin of the app, so Standard
    Access is enough to read with your own account. No App Review or business
    verification is needed for this.

## D. Token, then let the script do the rest

11. Open **Graph API Explorer** (developers.facebook.com/tools/explorer):
    - **Meta App**: select your app.
    - **User or Page**: *Get User Access Token*.
    - **Permissions**: `instagram_basic`, `instagram_manage_insights`,
      `pages_show_list`, `pages_read_engagement`. If the Page is managed through a
      Business portfolio, also add `business_management` and `ads_read`.
    - **Generate Access Token** → in the dialog, select the Centoire Page and Instagram account.
    - Copy the token. It's short-lived (about an hour), so do the next step right away.
12. In `Discovery-Engine/`:
    ```bash
    .venv/bin/python -m scripts.instagram_setup
    ```
    Paste the token at the hidden prompt. The script exchanges it for a ~60-day token,
    finds your Instagram account ID, test-reads @nike, and saves `IG_USER_ID`,
    `IG_ACCESS_TOKEN` and `IG_TOKEN_EXPIRES_AT` to `.env`. It prints nothing secret.
13. Check the watchlist handles (one API call each):
    ```bash
    .venv/bin/python -m scripts.instagram_setup --check-watchlist
    ```
    Fix or remove the handles it marks ✗ in `instagram.yaml`.
14. Restart the engine, then open `http://localhost:8090/instagram`. It should show
    `"configured": true`. New posts appear in `/items?role=insider` and `/items?role=brand`.

## Keeping it running

- The token lasts about **60 days** (see `IG_TOKEN_EXPIRES_AT` in `.env`). Repeat steps 11–12 before then.
- For a token that doesn't expire, create a **System User** in Business settings →
  Users → System users, assign it the app and the Page, generate a token with the same
  permissions, and run `python -m scripts.instagram_setup --system-user`.

## Limits worth knowing

- Only **Business/Creator** accounts can be read; personal accounts and age-gated
  accounts can't. Stories aren't available.
- Meta doesn't publish the exact hourly allowance. The engine plans for 180 calls/hour
  (`IG_MAX_CALLS_PER_HOUR`), watches the `X-App-Usage` header and pauses itself when
  usage passes 75% or Meta returns a throttling error (codes 4, 17, 32, 613).
- Accounts tagged in watched posts show up at `GET /instagram/candidates`: review them
  and add the good ones to `instagram.yaml`.

## Troubleshooting

| Error | Meaning | Fix |
|---|---|---|
| `[190]` | Token expired or revoked | Repeat steps 11–12 |
| `[10]` / `[200]` permission errors | A permission is missing | Regenerate the token with all permissions in step 11 |
| `[100]` / `[110]` on a handle | Handle doesn't exist or isn't a Business/Creator account | Fix or remove it in `instagram.yaml` |
| `[4]`, `[17]`, `[32]`, `[613]` | Rate limited | Nothing: the engine waits and resumes |
