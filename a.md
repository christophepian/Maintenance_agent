# Copilot Prompt — Integrate Roadmap Generator into Maintenance Agent

Paste this into GitHub Copilot Chat in VS Code (use **@workspace** mode for best results).

---

## PROMPT

```
@workspace

I need you to integrate a self-updating product roadmap system into this monorepo. 
I will give you all the files to create and exactly where to place them.
Do not modify any existing source files. Only create new files and make one small 
addition to the root package.json.

---

### CONTEXT

This is a Node.js + TypeScript monorepo with the following structure:
- apps/api/         → Node.js/Express backend
- apps/api/prisma/schema.prisma  → Prisma schema (45+ models)
- apps/api/src/workflows/        → Workflow files (.ts)
- apps/api/src/routes/           → Route files (.ts)
- apps/api/src/services/         → Service files (.ts)
- apps/web/         → Next.js frontend
- package.json      → Root package.json (monorepo)

---

### TASK

Create the following files exactly as specified. After creating all files, run 
`node scripts/generate-roadmap.js` to verify it works.

---

### FILE 1 — Create: `scripts/generate-roadmap.js`

This is a zero-dependency Node.js script that reads ROADMAP.json and scans the 
codebase to generate docs/roadmap.html.

Key behaviours:
- Reads ROADMAP.json from the repo root
- Scans apps/api/prisma/schema.prisma for model and enum names
- Scans apps/api/src/workflows/ for .ts workflow files
- Scans apps/api/src/routes/ for .ts route files  
- Scans apps/api/src/services/ for .ts service files
- Checks .env, .env.local, .env.production for env keys
- Reads .git/HEAD for branch + commit info
- For each feature in ROADMAP.json, runs a detection check:
    - model_exists   → checks if model name is in schema.prisma
    - model_field    → checks if field exists on a model
    - enum_exists    → checks if enum name is in schema.prisma
    - workflow_exists → checks if a .ts file exists in workflows/
    - file_exists    → checks if a file exists at a relative path
    - env_key        → checks if a key exists in any .env file
- Outputs docs/roadmap.html — a dark-theme HTML file with:
    - Phase blocks (P0-P5) each showing feature cards
    - Feature cards showing status (DONE / IN PROGRESS / PLANNED) based on detection
    - Custom items section per phase (from custom_items[] in ROADMAP.json)
    - Tab for all custom items across phases
    - Tab showing all codebase detection signals in a table
    - Tab with "How to Use" instructions
    - Stats bar: done count, in-progress count, total, % complete
    - Header showing git branch, commit, model count, workflow count
    - Timestamp and "AUTO-GENERATED" badge

Use the exact script content from the attached file: scripts/generate-roadmap.js

---

### FILE 2 — Create: `ROADMAP.json`

This is the source of truth for all roadmap data. It contains:
- _meta: version and description
- project: name, subtitle, repo, market
- phases[]: P0 through P5 with id, name, color, window, goal, status
- features[]: all roadmap features, each with id, phase, title, type, description, 
  detection block, hooks_existing[], hooks_new[], optional depends_on[]
- custom_items[]: personal items, user stories, discrete tasks (currently has one 
  placeholder "US-000" to demonstrate the format)
- financial_boundary: we_own[], grey_zone[], we_dont_own[]

Feature types: wire | build | extend | product | infra | refactor
Custom item types: user_story | discrete | bug | spike
Statuses: planned | in_progress | done | blocked
Phases: P0 (Foundation Hardening) | P1 (Cashflow Layer) | P2 (Private Landlord SaaS) 
        | P3 (AI Triage Upgrade) | P4 (NOI Intelligence) | P5 (ESG Layer)

Use the exact content from the attached file: ROADMAP.json

---

### FILE 3 — Create: `.vscode/tasks.json`

Add two VS Code tasks:
1. "Roadmap: Generate Once" — runs `node scripts/generate-roadmap.js`, group: build
2. "Roadmap: Watch + Auto-Regenerate" — runs `npm run roadmap:watch`, isBackground: true,
   runOptions.runOn: "folderOpen", watches for the generator starting and completing

---

### FILE 4 — Create: `.vscode/settings.json` (or merge into existing)

Add these Live Server settings:
- liveServer.settings.root: "/docs"
- liveServer.settings.file: "roadmap.html"
- liveServer.settings.donotShowInfoMsg: true

Also add JSON schema association: map ROADMAP.json to ./scripts/roadmap.schema.json

---

### FILE 5 — Create: `scripts/roadmap.schema.json`

A JSON Schema (draft-07) for ROADMAP.json that provides VS Code IntelliSense 
autocompletion when editing custom_items[]. 

The schema should validate:
- custom_items[].id: string, pattern ^[A-Z]+-[0-9]+$
- custom_items[].phase: enum ["P0","P1","P2","P3","P4","P5"]
- custom_items[].type: enum ["user_story","discrete","bug","spike"]
- custom_items[].persona: enum ["owner","tenant","manager","contractor","admin"]
- custom_items[].status: enum ["planned","in_progress","done","blocked"]
- custom_items[].ticket: string or null
- custom_items[].notes: string

---

### FILE 6 — Modify: `package.json` (root)

Add these two scripts to the existing scripts object. Do not change anything else:

"roadmap": "node scripts/generate-roadmap.js",
"roadmap:watch": "nodemon --watch ROADMAP.json --watch apps/api/prisma/schema.prisma --watch apps/api/src/workflows --ext ts,json,prisma --exec 'node scripts/generate-roadmap.js'"

---

### FILE 7 — Create: `docs/.gitkeep`

Create an empty docs/ directory with a .gitkeep so the output directory is tracked.
Add docs/roadmap.html to .gitignore (it is generated output — optional, your call).

---

### VERIFICATION STEPS

After creating all files, please:

1. Run: `node scripts/generate-roadmap.js`
   Expected output:
   ```
   🔍 Reading ROADMAP.json...
   📊 Reading codebase signals...
      Models: [N] · Enums: [N] · Migrations: [N]
      Workflows: [N] · Routes: [N]
   ⚡ Generating HTML...
   ✅ Written → docs/roadmap.html
   ```
   The model/workflow/route counts should match your actual codebase (45 models expected).

2. Open docs/roadmap.html in a browser or with Live Server.
   - Verify the stats bar shows the correct model count
   - Verify P0 phase shows 4 features (email, legal DSL, Skribble, route refactor)
   - Verify all feature cards show PLANNED status (none should be auto-detected as DONE 
     unless you've already shipped them)

3. Test custom item addition:
   - Open ROADMAP.json
   - Add a new entry to custom_items[] (copy the US-000 placeholder, change id/title)
   - Run `node scripts/generate-roadmap.js` again
   - Verify the new item appears in the Custom Items tab

---

### NOTES FOR COPILOT

- The generate-roadmap.js script uses ONLY Node.js built-ins (fs, path). Zero npm 
  dependencies needed to run it.
- For watch mode (`npm run roadmap:watch`), nodemon is needed: 
  `npm install --save-dev nodemon`
- The Live Server VS Code extension (ritwickdey.liveserver) is needed for auto-refresh.
  Install it if not already present.
- Do NOT modify schema.prisma, any source files, or existing application code.
- The docs/roadmap.html file is generated output. The developer should open it with 
  Live Server and leave it open — it will refresh automatically every time the 
  generator runs.
- ROADMAP.json is the only file the developer manually edits (to add custom items, 
  user stories, or update phase status). Everything else is read from the codebase.

---

### ATTACHED FILES

The exact file contents to use are in the chat attachments:
- scripts/generate-roadmap.js
- ROADMAP.json

Use those exact contents — do not rewrite or summarize them.
```

---

## HOW TO USE THIS PROMPT

1. Open **GitHub Copilot Chat** in VS Code (`Ctrl+Shift+I` or the chat icon)
2. Switch to **@workspace** mode (type `@workspace` at the start, or select it from the slash menu)
3. Attach the two files: `scripts/generate-roadmap.js` and `ROADMAP.json` (drag them into the chat, or use the paperclip icon)
4. Paste the prompt above
5. Copilot will create all 7 files and run the verification

## AFTER INTEGRATION

```bash
# One-time: install Live Server in VS Code
# Extension: ritwickdey.liveserver

# One-time: install nodemon for watch mode
npm install --save-dev nodemon

# Generate the roadmap
npm run roadmap

# Right-click docs/roadmap.html → Open with Live Server

# From now on — just run this and leave it running:
npm run roadmap:watch
```

Every time you push a migration, create a workflow, or add a service file, 
the roadmap card automatically flips status on the next generation cycle.

To add a user story: edit `custom_items[]` in `ROADMAP.json`, save, done.
