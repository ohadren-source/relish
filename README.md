# RELISH v3.2.3 — Diagnostic Build

## What changed

v3.2.3 turns Apple's App Review process into the debugger. Every time the paywall loads, fails, succeeds, or is manually inspected, the app captures a complete state snapshot (bundle ID, SDK version, offerings result, error codes, StoreKit storefront, entitlements, timestamps, session ID) and POSTs it to your Railway backend. You read the reviewer's device state from your own logs.

No native code. Ships through the existing EAS build pipeline. Replaces `App.js` and adds one backend route.

## Files

- **`App.js`** — drop-in replacement for the current `App.js` on the `perfprof` branch. 1380 lines. All existing behavior, branding, disclosures, and layout preserved. Adds diagnostic instrumentation throughout the IAP lifecycle.
- **`paywall_diagnostic_route.py`** — new Flask route to paste into the existing backend on Railway. Mounts at `POST /api/relish/paywall-diagnostic` and logs to `/app/paywall_diagnostics.jsonl`. Also includes an optional `GET /api/relish/paywall-diagnostic/tail` for reading from a browser.

## Install

### App side
1. Replace `App.js` on `perfprof` with the new file.
2. Install the two new expo deps (likely already present; add if missing):
   ```
   npx expo install expo-application expo-constants
   ```
   `expo-device` and `react-native-purchases` are already installed.
3. Commit, push, trigger an EAS build, submit to App Store Connect.

### Backend side
1. Open the Flask app file on Railway.
2. Paste the contents of `paywall_diagnostic_route.py` into it (or import as a blueprint). Remove the commented-out `from your_app_module import app` line — use your existing `app` object directly.
3. (Optional) Set `RELISH_DIAG_TOKEN` as a Railway env var to gate the `/tail` endpoint behind a shared secret.
4. Deploy.

## The diagnostic flow

### Automatic fires (no user action required)
- **App launch** → `launch` event. Every install reports its bundle ID, SDK version, RC SDK state.
- **Paywall opened, offerings fetched OK** → `offerings_loaded` event with the returned package list.
- **Paywall opened, offerings empty (the pathological state)** → `offerings_empty` event.
- **Paywall opened, offerings fetch threw** → `offerings_error` event with full error object.
- **Purchase attempted, error thrown** → `purchase_error` event with the StoreKit/RevenueCat error code.
- **Purchase succeeded** → `purchase_success` event.
- **Restore errored** → `restore_error` event.
- **Init errored** → `init_error` event.

### Manual fires (reviewer or user opens the panel)
- **Tap the "Show Diagnostic" button** (appears in the fallback alert and in the error banner) → opens panel + fires `diagnostic_opened`.
- **Tap the "Paywall not working? Tap here to show diagnostic" footer link** → opens panel + fires `diagnostic_opened`.
- **Triple-tap the "RELISH Peak" title inside the paywall modal** → opens panel + fires `diagnostic_opened`. Hidden from normal users; for the developer or a reviewer following the review notes.
- **Tap "Send to Developer" inside the panel** → fires `diagnostic_sent_by_user`.

All events include the same snapshot structure. The `session_id` lets you correlate every event from a single app launch on a single device.

## Reading the logs

From the Railway shell:
```
# Live tail
tail -f /app/paywall_diagnostics.jsonl

# Last 20 empty-offerings events (the smoking gun for the current issue)
grep '"kind": "offerings_empty"' /app/paywall_diagnostics.jsonl | tail -20

# Everything from a specific session (e.g. from review notes)
grep 'rlsh-1745321234567-ab12cd' /app/paywall_diagnostics.jsonl
```

Or from a browser (if `RELISH_DIAG_TOKEN` is set):
```
curl -H "X-Diag-Token: $TOKEN" \
  "https://sauc-e-backend-production.up.railway.app/api/relish/paywall-diagnostic/tail?n=20&kind=offerings_empty"
```

## Review notes template

Paste this into the "Notes" field in App Store Connect for the next submission. It reframes the whole conversation: you're not arguing, you're asking them to help you debug.

```
Thank you for reviewing RELISH v3.2.3.

We have been unable to reproduce the subscription purchase issue reported
in previous review rounds on our own devices or sandbox accounts. To
resolve this, this build includes a diagnostic facility that captures the
exact state of the subscription system when the paywall is opened on your
review device.

If the "Upgrade to Peak" button behaves unexpectedly, please:

1. Open the paywall by tapping "Upgrade to Peak · 10 free left" on the
   main screen.
2. If an error alert appears, tap "Show Diagnostic" in the alert.
3. Alternatively, scroll to the bottom of the paywall and tap the
   "Paywall not working? Tap here to show diagnostic" button.
4. The diagnostic panel displays every relevant piece of state. It is
   automatically sent to our server when opened; tapping "Send to
   Developer" sends a confirmation copy.
5. Please include the Session ID shown at the bottom of the diagnostic
   panel in your response to this submission. This lets us correlate
   your review session with our server logs.

The web versions of our three sister apps are live and successfully
processing payments via PayPal, Stripe, and Square at sauc-e.com,
cats-up.app, and catsup.net. The issue appears to be specific to the
App Store Connect / StoreKit integration on review devices, which we
cannot directly observe from our development environment.

Thank you for your help resolving this.
```

## What you'll see in the logs

The first `offerings_empty` event from a reviewer's device will contain:

- The reviewer's storefront country code (confirms which ASC region is being queried).
- The exact bundle ID the build shipped with (confirms no build-level drift).
- The RevenueCat public key prefix/suffix (confirms correct key shipped).
- The list of package identifiers RevenueCat returned (should be `[]` if products are in review).
- The `allOfferingIds` — whether RC even has an offering configured.
- `activeEntitlements` and `activeSubscriptions` on the reviewer's Apple ID (whether a previous sandbox purchase is lingering).
- The StoreKit environment as reported by RC.

This is the data that tells you whether the failure is: (a) products legitimately in review and unfetchable, (b) a region/storefront issue, (c) a RevenueCat offering misconfiguration, or (d) something genuinely novel.

## What stays the same

- Branding, colors, layout, copy — all preserved.
- Subscription disclosures (title, length, price, auto-renew language) — all preserved and Apple Guideline 3.1.2(c) compliant.
- Required links (Privacy Policy, Terms of Use / Apple Standard EULA) — all preserved.
- Restore Purchases button — preserved.
- Fallback alert behavior when products can't load — preserved, now with an added "Show Diagnostic" option.
- All existing backend routes (`/api/relish/usage-status`, `/api/relish/get-wisdom`) — untouched.

## Notes

- The diagnostic POST is best-effort. If the backend is unreachable, the app continues normally — the diagnostic failure is swallowed so it can never block a purchase.
- All sensitive-looking fields (the RC public key) are truncated in the payload to prefix+suffix. The full key is not in the diagnostic even though it's already a public key.
- The `50ms` sleep after `Purchases.configure` closes a race window that could produce empty offerings on slow review-device networks even when everything is configured correctly. This is a small fix unrelated to diagnostics but worth having in this same build.
