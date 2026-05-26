# ReClip

Your private, self-hosted video extraction workbench.

## Features

- **1000+ Sites Supported:** Powered by yt-dlp to extract from almost any site.
- **Formats:** Download as MP4 (Video) or MP3 (Audio).
- **Quality Picker:** Choose your preferred resolution before downloading.
- **Bulk Downloads:** Paste multiple URLs at once.
- **Deduplication:** Automatically skips duplicate links.
- **No-Framework UI:** A clean, responsive interface built in a single HTML file with vanilla CSS/JS.
- **Lightweight Backend:** ~150-line Python Flask server.

## Quick Start

1. Ensure Python 3 and ffmpeg are installed:
   - macOS: `brew install ffmpeg`
   - Debian/Ubuntu: `sudo apt update && sudo apt install ffmpeg`
2. Clone the repository and run the launcher script:
   ```bash
   git clone https://github.com/yourusername/reclip.git
   cd reclip
   chmod +x reclip.sh
   ./reclip.sh
   ```
3. Open [http://localhost:8899](http://localhost:8899) in your browser.

## Docker

To run ReClip using Docker:

```bash
docker build -t reclip .
docker run -p 8899:8899 reclip
```

Then visit [http://localhost:8899](http://localhost:8899).

## Usage

1. Paste one or more video URLs into the text area.
2. Choose your desired output format (MP4 Video or MP3 Audio).
3. Click **Fetch Metadata**.
4. (Optional) For MP4s, select your preferred video quality.
5. Click **Download** on individual videos, or **Download All** for bulk extraction.

## Supported Sites

ReClip extracts media from over 1,000 websites, including:
- YouTube
- TikTok
- Instagram
- Twitter / X
- Reddit
- Facebook
- Vimeo
- Twitch
- Dailymotion
- SoundCloud
- Loom
- Streamable
- Pinterest
- Tumblr
- Threads
- LinkedIn
...and many more!

## Stack

- **Backend:** Flask (Python)
- **Frontend:** Vanilla HTML / CSS / JavaScript
- **Engine:** yt-dlp + ffmpeg
- **Dependencies:** Only 2 (`flask`, `yt-dlp`)

## Avoiding YouTube bot checks

If YouTube blocks your downloads with "Sign in to confirm you're not a bot", you can provide ReClip with your browser cookies:

1. **Use your browser's cookies directly:**
   Set the `COOKIES_FROM_BROWSER` environment variable before running the script.
   ```bash
   export COOKIES_FROM_BROWSER="chrome"
   ./reclip.sh
   ```
   *(Supported values: chrome, firefox, brave, edge, safari. Note: The browser may need to be closed for the script to read its database safely on some platforms.)*

2. **Use a cookies.txt file:**
   Export your cookies to a Netscape-format text file, then point ReClip to it:
   ```bash
   export COOKIES_FILE="/path/to/cookies.txt"
   ./reclip.sh
   ```

## Disclaimer

ReClip is intended for personal use only. Please respect copyright laws and the Terms of Service of the platforms you are downloading from.

## License

MIT License
