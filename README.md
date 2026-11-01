# Savantutorials — Savant AI Tutorial Studio (starter)

Automated **staging-only** tutorial capture for Savant Talent. This starter records a real browser session using Playwright and renders MP4 with FFmpeg. It does not pretend to have integrated Gauntlet, Screenity, Claude or mcp-video automatically: those are optional future adapters.

## Setup
```sh
cd Savantutorials
npm install
npx playwright install chromium
# install ffmpeg separately
cp .env.example .env
npm run record -- job-feed
```
Requires Node 20+, Playwright browser, FFmpeg, and a staging Talent account. Never use real applicant records.

## Scenes
- `job-feed` — search and explore jobs
- `applications` — application repository and progress selector
- `coach` — coach assignment and recommendations
- `employers` — employer ratings exploration (route must be verified)
- `industry` — industry data exploration (route must be verified)
- `autofill` — extension-dependent; requires an isolated browser profile and test application site; not automated in starter

The recorder refuses to run without `STAGING_BASE_URL` and a non-production hostname; navigation selectors are best-effort and must be validated against staging.

## Proposed agent architecture
1. **Planner (Claude)**: read feature manifest, draft factual scripts, and plan safe demo paths. Human approves script.
2. **Persona explorer (Gauntlet / computer-use adapter)**: explore staging as Talent, Coach, Recruiter, Admin with independent test identities. Capture discrepancies.
3. **Deterministic runner (Playwright)**: log in with synthetic account, navigate, verify visible feature, record video and screenshots; fail closed if missing.
4. **Capture (Playwright built-in video)**: canonical automation capture. Screenity is optional for manual recordings, not an unattended automation dependency.
5. **Editor (FFmpeg)**: transcode to MP4; optional mcp-video adapter for captions, scene composition and overlays.
6. **QA**: verify no PII/secrets, actual feature existence, script accuracy, audio/video sync, captions, and accessibility.

Never upload, submit applications, send emails, or contact employers during demo runs. No production credentials. Store all footage as ephemeral artifacts and redact private data before publication.
