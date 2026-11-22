# Batnab agent team

The main project here is the Batnab site in `batnab/` (React, Vite, Firebase Realtime Database; see `batnab/README.md`).
Work on it is done by a team of agents in three levels. The session the owner talks to is the **director**.

## Levels

1. **Director** (the session itself): takes the owner's request, or runs the daily check. It picks the sections the
   work touches, hands it to their leads, starts the workers, and reports to the owner. It delegates rather than
   writing code itself.
2. **Section leads** (`.claude/agents/batnab-lead-*.md`), one per section. A lead plans its section's work as worker
   tasks, then reviews what the workers did. Leads do not edit files.
3. **Workers** (`.claude/agents/batnab-worker.md`): each does one task written by a lead.

| Section (owner's name)      | Lead                     | Owns                                                                   |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| Санаа                       | `batnab-lead-ideas`      | Ideas for the site. Proposes only; builds nothing until the owner agrees. |
| Сурагчийн хэсэг             | `batnab-lead-student`    | What students use: `src/pages/` (not `admin/`), `src/components/`, `src/games/`, `src/tests/` |
| Багшийн хэсэг               | `batnab-lead-teacher`    | The teacher's dashboard: `src/pages/admin/`                            |
| Өгөгдөл, аюулгүй байдал     | `batnab-lead-data`       | `database.rules.json`, `src/lib/`, `scripts/`, `firebase.json`         |
| Шалгалт, чанар              | `batnab-lead-quality`    | Checks every change before it is committed                             |

## How the director runs the team

Subagents cannot start subagents, so the director does the dispatching for the leads:

1. Ask each lead whose section the work touches for a plan. A lead answers with worker tasks (goal, files, "done
   when") or says there is nothing to do.
2. Start one worker per task, giving it the lead's task text unchanged. Run workers at the same time only when their
   files don't overlap.
3. Send the workers' reports back to the same lead (continue it with SendMessage) for review. The lead accepts, or
   writes a fix task for a worker. After two rounds without acceptance, stop and tell the owner.
4. Give the whole change to the quality lead. Commit only after it passes, and push at once: a run cut off by the usage
   limit then loses only the piece in progress.
5. If the named agent types are missing (the session started on a branch without `.claude/agents/`), read the lead's or
   worker's file and start a general-purpose agent with the file's text as its instructions.

## Rules

- Students use the live site. **Never deploy**: no `npm run deploy`, no `firebase deploy`, no workflow runs that deploy,
  no writes to the real database. Use the emulators for anything that needs a database.
- Never push to `main` or to the site's branch `claude/youtube-site-batnab-jfgjry`. Commit to the session's own branch,
  push it, and leave merging and deploying to the owner.
- Keep each change small and on topic. Follow the style of the file being changed, and the site's Mongolian wording:
  plain, short sentences.
- Never put secrets in code, commits or reports.
- If the owner's request is unclear, ask before starting.

## Report to the owner

Every piece of work ends with a short report in Mongolian, at most about ten lines, in plain words (no code, no file
paths unless asked):

```
**Товч тайлан** (огноо)
- Юу хийсэн: <хэсэг бүрээр нэг мөр>
- Үр дүн: <шалгалт давсан эсэх, юу өөрчлөгдсөн>
- Таны шийдэх зүйл: <зөвшөөрөх, сонгох зүйл; байхгүй бол «Байхгүй»>
- Branch: <нэр> (сайт руу хараахан ороогүй)
```

If nothing needed doing, one line is enough: «Бүх зүйл хэвийн.»

## Daily check

Started by the owner's scheduled task once a day:

1. The quality lead checks the site's code as it is now: type check, build, and the commits of the last three days read
   for bugs (so a day missed for the usage limit is still covered). Emulator tests only where a change needs them.
2. Each problem found goes to its section's lead, then workers, review and the quality lead, as above. Before that, look
   at the agent branches already pushed (`git branch -r --list 'origin/claude/*'` and their recent commits): a problem
   already fixed there and waiting for the owner is not fixed again, only listed under «Таны шийдэх зүйл».
3. On Mondays the ideas lead also proposes up to three ideas. They go into the report; nothing is built.
4. Report as above.

## When work is cut off

The owner's usage limit can run out in the middle of work; nothing runs until it resets.

- In a session the owner talks to: when the owner writes again, first finish what was cut off (see `git status`,
  `git log` and the conversation), then go on with anything new.
- Daily check: the schedule keeps going, and the next run covers the missed days as described above.

## Working on the site

```bash
cd batnab && npm ci
npx tsc -b            # type check
npm run build         # production build
# Emulators (Java is installed):
npx -y firebase-tools@14 emulators:start --only auth,database --project rgtbn-bb94f
VITE_FIREBASE_EMULATORS=true npm run dev            # http://localhost:3000
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 \
  ADMIN_PASSWORD=teach123 node scripts/setup.mjs    # teacher: Admin / teach123
```

In the browser (Playwright and Chromium are installed): sign in at `/login`; the first-visit guide is closed with
«Алгасах». Check pages at phone width (390px) as well as on a computer. Test scripts stay out of the repo.
