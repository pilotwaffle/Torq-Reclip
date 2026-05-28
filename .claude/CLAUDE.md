# Torq ReClip — Project Intelligence

**Project**: Private, self-hosted video extraction workbench powered by yt-dlp.
**Status (2026-05)**: Hybrid architecture in transition. Significant documentation and dependency debt.

---

## Current Architecture (Ground Truth)

- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 + Framer Motion (runs on port 3000)
- **Backend**: Flask (Python) + yt-dlp + ffmpeg (runs on port 8899)
- **Dev Command**: `./dev.sh` (recommended) — starts Flask in background + Vite with correct `/api` proxy
- **Legacy Command**: `./reclip.sh` — old launcher, assumes vanilla HTML UI on 8899 (largely obsolete)
- **Key Integration**: Vite proxies `/api/*` → `http://127.0.0.1:8899`

**Critical**: The root `README.md` is **outdated** and describes a previous vanilla HTML + Flask-only version that no longer represents the active codebase.

---

## Development Commands

```bash
./dev.sh           # Normal development (Flask + Vite)
./dev.sh --clean   # Fresh venv + reinstall requirements

# Backend logs
cat reclip_backend.log
```

## Security & Safety Rules

1. **Never trust client input** for `format_id`, URLs, or cookies.
2. Security hardening (H1/H2/H3) has been applied on this branch:
   - H3: `format_id` allowlist + regex validation
   - H2: SSRF protection via DNS resolution (rejects private/loopback/link-local/etc.)
   - H1: Optional bearer token auth (`RECLIP_AUTH_TOKEN`), default bind to 127.0.0.1, and per-route rate limits via Flask-Limiter
3. The full original spec is still useful for reference: `docs/security-hardening-h1-h3-spec.md`
4. Always prefer the error handling patterns in `parse_ydl_error` and `src/utils/errors.ts`.

## Preferred AI Workflow (Use These Skills)

- **Before any significant feature or refactor**: Use `brainstorming` skill.
- **Before writing code for multi-step work**: Use `writing-plans`.
- **During implementation of plans**: Use `subagent-driven-development` (or `executing-plans`).
- **Any bug, flaky behavior, or "why is this happening?"**: Use `systematic-debugging` **before** proposing fixes.
- **Frontend / UI work**: Default to patterns from `torq-frontend-architect` skill.
- **Before claiming anything is done**: Use `verification-before-completion`.

## Code Style & Tooling

**Python**:
- Ruff configuration in `pyproject.toml` (line-length 120, select E,W,F,I,B,UP)
- One notable per-file ignore for long error strings in `reclip.py`

**TypeScript/React**:
- Strict TypeScript
- Prefer small, well-typed components
- Use existing patterns in `Downloader.tsx` and `types.ts` (good error states, task lifecycle, history)

## Known Technical Debt (Do Not Ignore)

- README lies about the stack (vanilla HTML claims)
- `package.json` contains unused/dead dependencies:
  - `express`
  - `ffmpeg-static`
  - `@google/genai`
  - `@types/express`
- Name is still `"react-example"` instead of something meaningful
- Two conflicting launch scripts
- Security hardening spec written but not yet implemented in code
- Old `index.html` is still being served by Flask at `/`

## When Working in This Project

- Keep the hybrid nature in mind (React talks to Flask via `/api`).
- Changes to download logic usually need updates in both `reclip.py` **and** `src/components/Downloader.tsx` + `src/utils/errors.ts`.
- Cookie handling is important for YouTube/TikTok reliability — respect the existing `/api/cookies` flow.

---

**Goal**: Turn this from a promising but messy personal tool into a clean, trustworthy, well-documented project that matches its actual capabilities.