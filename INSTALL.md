# RELISH v3.2.3 — Fix Files Install Guide

These two files are tweaks to your existing project to make it ready to receive sibling-Claude's `App.js` and ship as v3.2.3.

## What's in this folder

- **`package.json`** — your existing package.json with version bumped to `3.2.3` and the two missing expo deps added (`expo-application`, `expo-constants`)
- **`app.json`** — your existing app.json with version bumped to `3.2.3` (everything else identical)

## What's NOT in this folder (because you already have these from sibling-Claude)

- `App.js` — sibling-Claude's drop-in replacement (1380 lines, drop into the `perfprof` branch)
- `paywall_diagnostic_route.py` — paste into your Railway Flask app
- The submission notes and rejection-response templates from sibling-Claude's `Apple_Review_Correspondence___v3_2.md`
- The README from sibling-Claude's `README.md`

## Install order

```bash
cd <your_relish369nu_project_folder>

# 1. Replace package.json with the new one from this folder
cp /path/to/this/folder/package.json ./package.json

# 2. Replace app.json with the new one from this folder
cp /path/to/this/folder/app.json ./app.json

# 3. Replace App.js with sibling-Claude's version
cp /path/to/sibling-claude/App.js ./App.js

# 4. Run Charlie to clean caches (resolves the new deps fresh)
bash scripts/charlie.sh

# 5. EAS build
npx eas-cli build --platform ios --profile production --clear-cache

# 6. Deploy backend (paste paywall_diagnostic_route.py contents into your existing Flask app)

# 7. Submit to App Store Connect with sibling-Claude's review notes
```

## What changed line-by-line

### `package.json` diff vs your current

```diff
-  "version": "3.1.3",
+  "version": "3.2.3",

   "dependencies": {
     "expo": "~54.0.0",
+    "expo-application": "~7.0.0",
+    "expo-constants": "~18.0.0",
+    "expo-device": "~7.0.1",
     "react": "19.1.0",
     "react-dom": "19.1.0",
     "react-native": "0.81.5",
-    "react-native-purchases": "^8.12.0",
-    "expo-device": "~7.0.1"
+    "react-native-purchases": "^8.12.0"
   },
```

Note: I also reordered the dependencies alphabetically while I was in there. Functionally identical, just easier to scan.

### `app.json` diff vs your current

```diff
-    "version": "3.1.3",
+    "version": "3.2.3",
```

That's the only change. Everything else (Bundle ID, RevenueCat key, EAS project ID, splash, icon, all of it) preserved character-for-character.

## Why these two files specifically

Sibling-Claude's `App.js` will import `expo-application` and `expo-constants` for capturing app version, build number, install ID, and similar metadata in the diagnostic payload. Without those packages installed, the build either fails at the import step or runs with `undefined` values that crash when the diagnostic POST tries to serialize them.

Sibling-Claude's submission notes are written for v3.2.3 explicitly. Submitting a build numbered 3.1.x with notes saying "Thank you for reviewing v3.2.3" reads to Apple Review as someone who doesn't have control of their own pipeline. Version-string consistency matters when the submission notes are the load-bearing part of the strategy.

## After install, before submitting

Quick sanity check — these three commands should all succeed:

```bash
# Confirm the deps actually got pulled in by Charlie's npm install
ls node_modules/expo-application/package.json
ls node_modules/expo-constants/package.json

# Confirm version is consistent across both config files
grep '"version"' package.json app.json
```

Both `ls` commands should print a path. The grep should show `3.2.3` twice.

If any of those fail, something didn't install cleanly and the EAS build will fail in a confusing way. Catch it before submitting.

## What stays the same

- Bundle ID: `com.nife36.relish369`
- RevenueCat public key: `appl_gNFmOHvscXhhhoQWpgDvVPQeLZm`
- EAS Project ID: `2260c77f-4a38-46b3-bd13-65b1db3407f6`
- Owner: `ohadren`
- Apple Team: `2D8HXWPG93`
- Backend URL: `https://sauc-e-backend-production.up.railway.app`
- Charlie's exorcism script: unchanged
- All existing assets, splash, icon: unchanged

Nothing in the build/sign/submit chain that we already verified against your screenshots is touched.
