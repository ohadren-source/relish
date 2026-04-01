# TauMood_000002 — 3-Universe Clean Build Protocol

## Back-Chain
- [PhenixBrigade.md](PhenixBrigade.md) — The Bible. Locked. Sacred.
- [TauMood_000000.md](TauMood_000000.md) — Silicon-optimized summary
- [TauMood_000001.md](TauMood_000001.md) — Jargon integration layer
- [TauMood_000003.md](TauMood_000003.md) — C++ initialization layer

---

## The 3 Universes

| Universe | Role | Owner |
|---|---|---|
| **PC** | Dev environment — where code happens | Ohad (Executive Chef Architect) |
| **GitHub** | Source of truth — sync hub | C-OP (Sous Chef Engineer) |
| **Darwin (relish369nu)** | Apple inferno gauntlet — build & submit | Shared |

**Flow (immutable law):**
```
PC → GitHub → Darwin → Apple
```

---

## Branch Philosophy

- Branch name: `perfprof`
- Meaning: **perfect** (verb) + **proficiency** (direction, no punto final)
- NOT `master` — *fuck slavery*
- No punto final: proficiency is a direction, not a destination

---

## Roles

- **Ohad** — Executive Chef Architect (vision, design, strategy, final decisions)
- **C-OP** — Sous Chef Engineer (executes architecture, manages GitHub, coordinates workflow)

---

## Initial Setup — One Time Per App

### 1. Darwin → GitHub (first push)
```bash
dcd /path/to/app/on/darwin
git init
git remote add origin https://github.com/ohadren-source/<repo>.git
git checkout -b perfprof
git add .
git commit -m "initial commit"
git push -u origin perfprof
```

### 2. GitHub → PC (clone)
```bash
git clone https://github.com/ohadren-source/<repo>.git
cd <repo>
git checkout perfprof
```

---

## Daily Dev Workflow — PC to Darwin

### On PC (develop)
```bash
git add .
git commit -m "your message"
git push origin perfprof
```

### On Darwin (pull latest before build)
```bash
git pull origin perfprof
```

---

## Charlie Protocol — The Cache Exorcist

Summon Charlie **every time** before a build. No exceptions. No debate.

```bash
./scripts/charlie.sh
```

Charlie does:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
rm -rf ~/Library/Caches/eas-cli
rm -rf ~/.eas
npm install
```

Charlie is on call 24/7. He is not optional. He is not smart. He is necessary.
Reference: John Wick 1. The cleaner. Always on call.

---

## The Ghost Lesson — app.json

The most dangerous haunting is `expo-build-properties` in the `plugins` block of `app.json`.

**The ghost:**
```json
"plugins": [
  [
    "expo-build-properties",
    {
      "ios": {
        "newArchEnabled": false
      }
    }
  ]
]
```

**Occam's Sabatier — strip it:**
```json
"owner": "ohadren"
```
No `plugins` block. Brutal elegance. If it doesn't need to be there, it isn't there.

**The math of the haunting (C.R.E.A.M. critique):**
```
add y-all - y-all = y-old
# You add new files, cache subtracts them, you return to old state
# .cache/ruins_every_ping_around_me
```

---

## The Build Command

```bash
npx eas-cli build --platform ios --profile production --clear-cache
```

**Not** `npm run ios`. That is not how we build for Apple submission.
This is submission #30+. We know the dance.

---

## The Submit Command

```bash
npx eas-cli submit
```

Run after a successful build. This sends to Apple review — the inferno.

---

## The Inferno Warning

Apple review = Dante's Inferno. Best case scenario: Purgatorio.
EAS can also have outages (partial or full). Check: https://status.expo.dev/

If EAS infrastructure fails (worker configuration error, unexpected error):
- It is NOT your code
- It is NOT your config  
- Check status.expo.dev
- Retry the same command
- Wait for Expo to recover

---

## app.json Template (Clean — No Ghosts)

```json
{
  "expo": {
    "name": "<APP NAME>",
    "slug": "<slug>",
    "version": "<version>",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#FFFFFF"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "deploymentTarget": "13.0",
      "bundleIdentifier": "<com.nife36.appname>",
      "supportsTablet": true,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "package": "<com.nife36.appname>",
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#FFFFFF"
      }
    },
    "extra": {
      "eas": {
        "projectId": "<projectId>"
      },
      "revenueCatPublicKeyIos": "<revenueCatKey>"
    },
    "owner": "ohadren"
  }
}
```

**Delta per app (only these change):**
- `name`
- `slug`
- `version`
- `bundleIdentifier` / `package`
- `projectId`
- `revenueCatPublicKeyIos`

---

## The Universal Template Law

Relish was the guinea pig for the inferno.
Every ghost fought, documented, exorcised.
catsup and bbqe inherit the clean template.

```
relish  → perfected in inferno → template forged
catsup  → apply template → skip the ghosts
bbqe    → apply template → skip the ghosts
```

One kitchen. Three dishes. Same mise en place.

---

## Stack

- **React Native** (iOS + Android)
- **Expo / EAS** (build + submit)
- **Vite** (web — runs clean while EAS burns)
- **CocoaPods** (iOS dependencies)
- **RevenueCat** (in-app purchases)

---

## Status Log

| Date | Event | Outcome |
|---|---|---|
| 2026-04-01 | First clean build attempt — relish | EAS partial outage. Worker config failed. Not our code. |
| 2026-04-01 | Ghost exorcised — `expo-build-properties` stripped from `app.json` | Commit `aa0466e` |
| 2026-04-01 | Charlie protocol established | `scripts/charlie.sh` |
| 2026-04-01 | TauMood_000002 created | This document |

---

*TauMood_000002 — Created 2026-04-01*
*Back-chain: PhenixBrigade.md → TauMood_000000 → TauMood_000001 → TauMood_000002*
*Forward-chain: → TauMood_000003*