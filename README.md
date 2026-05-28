# ReClip

Your private, self-hosted video extraction workbench.

## Features

- **1000+ Sites Supported** — Powered by yt-dlp. Works with YouTube, TikTok, Instagram, X/Twitter, Reddit, and many more.
- **Video or Audio** — Download as MP4 or extract audio as MP3.
- **Quality Selection** — Choose resolution or audio quality before downloading.
- **Bulk Downloads** — Paste multiple URLs at once. Automatic deduplication.
- **Cookie Support** — Bypass bot protection on YouTube, TikTok, etc. by providing browser cookies.
- **Modern Interface** — Clean React frontend with real-time task tracking, history, and previews.
- **Self-Hosted & Private** — Everything runs locally on your machine.

## Current Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind + Framer Motion
- **Backend**: Flask (Python) + yt-dlp + ffmpeg
- **Development**: Run with `./dev.sh` (starts Flask on 8899 + Vite on 3000 with API proxy)
- **Engine**: yt-dlp (with sensible defaults for reliability)

> **Note**: Older versions of this project used a single vanilla HTML file. The current version uses a proper React frontend.

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js + npm
- ffmpeg (required for audio extraction and some video merges)

### Run Locally

```bash
git clone https://github.com/pilotwaffle/Torq-Reclip.git
cd Torq-Reclip

# Start both frontend and backend
./dev.sh
```

Then open **http://localhost:3000**

### With Fresh Environment

```bash
./dev.sh --clean
```

## Docker

```bash
docker build -t reclip .
docker run -p 8899:8899 reclip
```

> Note: The Docker image currently serves the backend on 8899. For the full modern experience, use the local dev script.

## Usage

1. Paste one or more video URLs.
2. Select output format (MP4 Video or MP3 Audio).
3. (Optional) Choose quality preset.
4. Click **Pull the Trigger**.
5. Monitor progress in the Extraction Log.
6. Completed downloads appear in History with optional in-browser preview.

## Handling Bot Protection (YouTube, TikTok, etc.)

ReClip supports two methods:

### 1. Browser Cookies (Recommended for local use)

```bash
export COOKIES_FROM_BROWSER="chrome"   # or firefox, edge, brave, safari
./dev.sh
```

The browser should be closed when starting ReClip on some platforms.

### 2. cookies.txt File

Export cookies using a browser extension (e.g. "Get cookies.txt") and place the file as `cookies.txt` in the project root, or point to it:

```bash
export COOKIES_FILE="/path/to/cookies.txt"
./dev.sh
```

## Project Scripts

| Command            | Description                              |
|--------------------|------------------------------------------|
| `./dev.sh`         | Start Flask backend + Vite frontend      |
| `./dev.sh --clean` | Fresh virtualenv + reinstall dependencies|
| `npm run build`    | Build production frontend                |
| `npm run preview`  | Preview production build                 |

## Security Notes

This tool directly executes yt-dlp with user-supplied URLs and format selectors.

- A security hardening specification exists in `docs/security-hardening-h1-h3-spec.md`.
- Several important input validation improvements are documented but not yet fully applied.
- Only run this tool with URLs and cookies you trust.

## License

MIT License

## Disclaimer

ReClip is intended for personal, offline use only. Please respect copyright laws and the Terms of Service of the platforms you download from. The authors are not responsible for misuse.