# RELISH v3.2.1 — Apple Review Notes

**Subject line for internal routing:** RELISH v3.2.1 — Diagnostic Fix — Session ID Required

---

## What Changed

v3.2.0 shipped with diagnostic instrumentation. One UI entry point wasn't rendering when offerings returned empty.

Fixed: diagnostic banner now shows whether offerings fail *or* return zero packages. Reviewer always has a "Show Diagnostic" button.

## What You'll See

1. Tap "Upgrade to Peak · [N] free left"
2. Paywall opens
3. If anything goes wrong with products, an error banner appears with a **"Show Diagnostic Details"** button
4. Tap it → diagnostic panel opens → Session ID appears at bottom
5. Include that Session ID in your response to us

That's it. One tap, one number, problem solved on both ends.

## If It Works Fine

Great. Tap the paywall title three times → diagnostic panel opens → confirms everything loaded correctly.

---

## Session ID Format

`rlsh-<timestamp>-<6 chars>`

Paste it in your response. We correlate it with our backend logs and identify exactly what your device saw.

---

## Context

Three sister apps live on the web (sauc-e.com, cats-up.app, catsup.net) processing payments via PayPal/Stripe/Square. We rebuilt RevenueCat from scratch before this submission. We cannot reproduce the v3.1.x failure locally. v3.2.1 is the instrumentation we use to see what your device sees.

Thank you.

—Chad with IT & Engineering
the sauc-e team
