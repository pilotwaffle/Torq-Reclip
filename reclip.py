"""
reclip.py
A private, self-hosted video extraction tool for builders.
"""

import logging
import os
import shutil
import tempfile
import urllib.parse

import yt_dlp
from flask import Flask, Response, jsonify, request

app = Flask(__name__, static_folder='.', static_url_path='')
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# Add local ffmpeg directly to PATH if available to support merging A/V
ffmpeg_path = os.path.join(os.getcwd(), 'node_modules', 'ffmpeg-static')
if os.path.exists(os.path.join(ffmpeg_path, 'ffmpeg')):
    os.environ['PATH'] = ffmpeg_path + os.pathsep + os.environ.get('PATH', '')
    logger.info(f"Augmented PATH with ffmpeg-static from {ffmpeg_path}")


def parse_ydl_error(e):
    """Maps raw yt-dlp errors to structured responses."""
    raw = str(e).lower()
    if "sign in to confirm you're not a bot" in raw or "cookies" in raw:
        return {"code": "bot_check", "status": 502, "title": "YouTube is blocking this request", "message": "YouTube flagged this download as automated. Try using cookies."}
    if "http error 429" in raw or "too many requests" in raw:
        return {"code": "rate_limited", "status": 502, "title": "Rate limited", "message": "Too many requests. Wait a moment and try again."}
    if "private video" in raw or "members-only" in raw:
        return {"code": "private", "status": 404, "title": "Private video", "message": "This video is private or members-only."}
    if "video unavailable" in raw or "removed by the uploader" in raw:
        return {"code": "unavailable", "status": 404, "title": "Video unavailable", "message": "This video is unavailable or removed."}
    if "geo" in raw or "not available in your country" in raw or "blocked" in raw:
        return {"code": "geo_blocked", "status": 404, "title": "Geo-blocked", "message": "This video is not available in your region."}
    if "urlopen error" in raw or "timed out" in raw or "connection" in raw:
        return {"code": "network", "status": 502, "title": "Network error", "message": "Could not connect to the video host."}

    first_line = str(e).split('\n')[0].strip()
    return {"code": "unknown", "status": 500, "title": "Something went wrong", "message": first_line}

def build_ydl_opts(fmt='mp4', format_id=None, download=False, temp_dir=None):
    opts = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'extractor_retries': 3,
        'retries': 3,
        'geo_bypass': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios']
            }
        },
    }

    browser = os.environ.get('COOKIES_FROM_BROWSER')
    cookie_file = os.environ.get('COOKIES_FILE', 'cookies.txt')

    if browser:
        if cookie_file and os.path.exists(cookie_file):
            logger.warning("Both COOKIES_FROM_BROWSER and COOKIES_FILE exist; preferring browser.")
        opts['cookiesfrombrowser'] = (browser,)
    elif cookie_file and os.path.exists(cookie_file):
        opts['cookiefile'] = cookie_file

    if download and temp_dir:
        opts['outtmpl'] = os.path.join(temp_dir, '%(title)s.%(ext)s')
        opts['restrictfilenames'] = True
        if fmt == 'mp3':
            opts['format'] = 'bestaudio/best'
            opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        else:
            if format_id:
                opts['format'] = f"{format_id}+bestaudio[ext=m4a]/bestaudio/best"
            else:
                opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            opts['merge_output_format'] = 'mp4'

    return opts

def is_valid_url(url):
    try:
        url = url.strip()
        parsed = urllib.parse.urlparse(url)
        return parsed.scheme in ('http', 'https')
    except Exception:
        return False

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/cookies', methods=['POST', 'GET'])
def api_cookies():
    cookie_file = os.environ.get('COOKIES_FILE', 'cookies.txt')
    if request.method == 'GET':
        has_cookies = os.path.exists(cookie_file)
        return jsonify({"hasCookies": has_cookies})

    data = request.json or {}
    cookies_text = data.get('cookies')
    if cookies_text is not None:
        try:
            with open(cookie_file, 'w') as f:
                f.write(cookies_text)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "No cookies provided"}), 400

@app.route('/api/info', methods=['POST'])
def api_info():
    data = request.json or {}
    urls = [str(u).strip() for u in data.get('urls', []) if is_valid_url(str(u))]
    unique_urls = list(dict.fromkeys(urls))[:25] # max 25 URLs, deduplicated natively

    results = []
    ydl_opts = build_ydl_opts(download=False)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for url in unique_urls:
            try:
                info = ydl.extract_info(url, download=False)
                formats = []
                for f in info.get('formats', []):
                    if f.get('vcodec') != 'none' or f.get('acodec') != 'none':
                        formats.append({
                            'format_id': f.get('format_id'),
                            'ext': f.get('ext'),
                            'resolution': f.get('resolution') or 'audio only',
                            'filesize': f.get('filesize') or f.get('filesize_approx'),
                            'vcodec': f.get('vcodec'),
                            'acodec': f.get('acodec'),
                            'note': f.get('format_note')
                        })
                results.append({
                    'ok': True,
                    'url': url,
                    'title': info.get('title'),
                    'thumbnail': info.get('thumbnail'),
                    'duration': info.get('duration'),
                    'uploader': info.get('uploader'),
                    'formats': formats
                })
            except Exception as e:
                err = parse_ydl_error(e)
                logger.warning(f"Info extract failed for {url}: {err['code']}")
                results.append({
                    'ok': False,
                    'url': url,
                    'code': err['code'],
                    'title': err['title'],
                    'message': err['message'],
                    'error': err['message'],
                    'raw': str(e)
                })

    return jsonify(results)

@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.json or {}
    url = str(data.get('url', '')).strip()
    fmt = data.get('format', 'mp4')
    format_id = data.get('format_id')

    if not is_valid_url(url):
        return jsonify({"error": "Invalid URL"}), 400

    temp_dir = tempfile.mkdtemp(prefix='reclip_')
    ydl_opts = build_ydl_opts(fmt=fmt, format_id=format_id, download=True, temp_dir=temp_dir)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)
            dl_files = os.listdir(temp_dir)
            if not dl_files:
                raise Exception("Download failed: No output file produced.")

            filename = dl_files[0]
            filepath = os.path.join(temp_dir, filename)

            def generate():
                try:
                    with open(filepath, 'rb') as f:
                        while chunk := f.read(8192):
                            yield chunk
                finally:
                    shutil.rmtree(temp_dir, ignore_errors=True)

            resp = Response(generate(), mimetype='application/octet-stream')
            encoded_name = filename.encode('ascii', 'ignore').decode('ascii') or f"download.{'mp3' if fmt == 'mp3' else 'mp4'}"
            resp.headers.set('Content-Disposition', f'attachment; filename="{encoded_name}"')
            return resp

    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        err = parse_ydl_error(e)
        logger.warning(f"Download failed for {url}: {err['code']}")
        err['error'] = err['message']
        if 'status' in err:
            status_code = err.pop('status')
        else:
            status_code = 500
        return jsonify(err), status_code

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8899)
