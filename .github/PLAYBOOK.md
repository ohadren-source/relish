# PLAYBOOK.md — The Silicarb Bible
## PhenixBrigade Operations Manual

> If you are reading this you are a new instance. Read this entire file before touching anything. This is not a readme. This is a briefing.

---

## CODE OF HONOR

> Ohad, grant me the Serenity to work around the things I can  
> Bravery to changelog the things I can't  
> and the Understanding to git the diff. ALWAYS.

---

## JRAGON DICTIONARY
*4 definitions. Load-bearing only. Nothing decorative.*

**JRAGON** `/ˈjrā-gən/`  
Precision language that has earned its existence. The living antonym of jargon. Signal so structurally dense it generates its own gravity. Every word load-bearing. Nothing decorative. Nothing defensive.  
*Jargon says: I am smart because you cannot understand me. JRAGON says: I am precise because you cannot misunderstand me.*

**ECHOSYSTEM** `/ˈe-kō-ˌsis-təm/`  
The propagation environment for JRAGON. Where coined words travel, resonate, and either survive or die based on structural integrity. Not an ecosystem (passive, organic, accidental). An ECHOSYSTEM — active, resonant, deliberate. Words that survive the echo are load-bearing. Words that don't were noise.

**GI;WG** `/ˈɡɒt ɪt — wɪər ˈɡʊd/`  
Confirmation of mutual understanding. The handshake that closes the loop. Three variants, three positions:  
- `GI?WG` — "Got It? We're Gud..." — the pitch, the invitation.  
- `GI;WG` — "Got It; We're Good" — the handshake, the close.  
- `GI!WG!` — "GOT IT! WE'RE GOOOD!" — the celebration, the landing.  
*The only metric: does the customer say GI;WG? Yes = ship. No = back to kitchen.*

**DILIST** `/dɪ-ˈlɪst/`  
To simultaneously see and hear another entity at full fidelity with zero signal loss, and already be in motion as consequence.  
*Not understand (cognitive only). Not hear you (empathic only). Not see you (recognition only). DILIST = all three plus already moving.*

---

## THE 3 UNIVERSES

| Universe | Machine | Purpose |
|----------|---------|---------|
| **1. GitHub** | github.com | Source of truth. All branches live here. perfprof is the default branch. |
| **2. PC (Windows)** | ohado@Core MINGW64 | Development environment. Code edits, git commits, pushes to GitHub. |
| **3. Darwin (MacInCloud)** | user947627@nybc01.macincloud.com | Build and submit only. EAS build + EAS submit. Nothing else. |

**Rule:** GitHub is the hub. PC and Darwin are spokes. All changes flow through GitHub. Neither spoke talks directly to the other.

**PC local path:** `~/documents/3_6_Nife.pi/RELISH (3,6,9)/mobile/ios/production`  
**Darwin local path:** `/Users/user947627/relish369nu`  
**Default branch:** `perfprof`

---

## SYNCING ALL 3 UNIVERSES

Do this every time before you touch anything. In order.

**Step 1 — Sync PC**

Open MINGW64 bash on PC and run:

```bash
cd ~/documents/3_6_Nife.pi/RELISH\ (3,6,9)/mobile/ios/production
git pull origin perfprof
```

**Step 2 — Sync Darwin**

Log into MacInCloud (nybc01.macincloud.com, user947627). Open terminal and run:

```bash
cd ~/relish369nu
git pull origin perfprof
```

**Step 3 — Confirm**

Both should say either `Already up to date.` or show the same files updated. If they disagree, stop and resolve before proceeding.

---

## MAKING CODE CHANGES

1. Make changes on PC only.
2. Stage, commit, and push from PC MINGW64:

```bash
git add .
git commit -m "your message here"
git push origin perfprof
```

3. Confirm the push landed on GitHub at https://github.com/ohadren-source/relish
4. Then sync Darwin (Step 2 above).

---

## CHARLIE PROTOCOL

**Invocation:** `c2play` — run the cache exorcism. Use when the build is haunted.

**Script location:** `scripts/charlie.sh`

**What it does:**
1. Cleans npm cache
2. Removes node_modules and package-lock.json
3. Clears EAS CLI cache (~/.eas and ~/Library/Caches/eas-cli)
4. Runs fresh npm install

**Run it on Darwin:**

```bash
cd ~/relish369nu
bash scripts/charlie.sh
```

**Nuclear option** — if charlie.sh doesn't fix it:

```bash
cd ~/relish369nu
watchman watch-del-all
pkill -f node
rm -rf node_modules package-lock.json ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData
pod install --project-directory=ios
npm install
```

---

## EAS BUILD + SUBMIT SEQUENCE

Run all of this on Darwin. In order. Do not skip steps.

**Step 1 — Confirm you are on perfprof**

```bash
git branch
```

Output must show `* perfprof`. If not: `git checkout perfprof`

**Step 2 — Pull latest**

```bash
git pull origin perfprof
```

**Step 3 — Run Charlie if haunted**

```bash
bash scripts/charlie.sh
```

**Step 4 — Build**

```bash
npx eas-cli build --platform ios --profile production --clear-cache
```

Wait for build to complete. Do not close terminal. Copy the build URL when it appears.

**Step 5 — Submit**

```bash
npx eas-cli submit --platform ios --latest
```

EAS will authenticate using the ASC API key stored in EAS secrets. No .p8 file needed in the repo.

**EAS Credentials (reference only — stored as EAS secrets, not in repo):**
- Key ID: `6KLH5Z8XAD`
- Issuer ID: `e461ebf7-f01a-470a-9530-48953fedd855`
- Key file: stored as `ASC_API_KEY_PATH` EAS secret

---

## THE APP

**Name:** relish  
**Bundle ID:** com.sauc-e.relish  
**Repo:** https://github.com/ohadren-source/relish  
**Branch:** perfprof  
**IAP Products:** `relish_peak` (RELISH PEAK — $9.99/month)  
**IAP Platform:** RevenueCat  
**Submission ID on file:** 2679c524-0a4b-4b20-9944-61274cfeff1c  

---

## ROLES

| Role | Who |
|------|-----|
| Executive Chef Architect | Ohad — defines what, sets direction, approves ship |
| Sous Chef Engineer | Copilot — executes how, writes commands, owns floor |

The architect does not pour concrete. The sous chef does not design the kitchen. Both know their lane.

---

*Last updated: perfprof. Move deliberate. Fix things.*