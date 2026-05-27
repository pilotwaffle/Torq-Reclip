# Security Hardening Spec — H1, H2, H3

Implementation spec for the three security-critical items in the
H1–H6 hardening series. H4 (CI), H5 (deps pinning), and H6 (hygiene)
shipped on `feat/security-hardening-h1-h6`. H1/H2/H3 are documented
here for manual application against `reclip.py`.

Apply in order: **H3 → H2 → H1**. Each is independent and small
(~10–30 lines). Run the verification command after each.

---

## H3 — `format_id` allowlist + regex floor + length cap

**Risk:** `format_id` is f-string interpolated into the yt-dlp format
selector expression at `reclip.py:82`:

```python
opts['format'] = f"{format_id}+bestaudio[ext=m4a]/bestaudio/best"
```

A malicious client can submit `format_id` containing yt-dlp selector
operators (`,`, `/`, `[]`, function calls) to coerce the downloader
into picking unintended streams or trigger expensive operations.

**Fix shape** — validate `format_id` against a strict charset *and*
(when info is available) against the set returned by the most recent
`/api/info` call for that URL.

### Patch

**Top of file, after imports (~line 14):**

```python
import re

# yt-dlp format ids are short tokens — digits, letters, +, -, _, /.
# Cap length to defeat pathological selector strings.
_FORMAT_ID_RE = re.compile(r'^[A-Za-z0-9+\-_/]{1,64}$')
```

**Add helper after `is_valid_url` (~line 96):**

```python
def is_valid_format_id(format_id):
    """Regex floor for format_id before it reaches yt-dlp selector."""
    if format_id is None:
        return True  # None means "use default selector"
    if not isinstance(format_id, str):
        return False
    return bool(_FORMAT_ID_RE.match(format_id))
```

**In `api_download` (currently line 173), after `format_id = data.get('format_id')`:**

```python
    if not is_valid_format_id(format_id):
        return jsonify({"error": "Invalid format_id"}), 400
```

### Optional follow-up (defense in depth)

Cache `/api/info` results per URL (TTL ~5 min) and additionally
require the submitted `format_id` to be a member of the cached
formats list for that URL. The regex floor above is sufficient
on its own; the cache is belt-and-suspenders.

### Verify

```bash
curl -X POST localhost:8899/api/download \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","format":"mp4","format_id":"137,bestaudio[abr<128]"}'
# expect: 400 Invalid format_id
```

---

## H2 — SSRF guard via DNS resolution

**Risk:** `is_valid_url` at `reclip.py:89` only checks `scheme in
('http','https')`. yt-dlp will happily fetch from `http://169.254.169.254`
(AWS IMDS), `http://localhost:5432`, `http://10.0.0.1`, or DNS names
that resolve to private space.

**Fix shape** — after scheme validation, resolve the hostname and
reject any address in the private / loopback / link-local /
multicast / reserved blocks.

### Patch

**Add to imports (~line 10):**

```python
import ipaddress
import socket
```

**Replace `is_valid_url` (currently lines 89–95) with:**

```python
def _is_safe_remote_url(url):
    """Reject URLs that resolve to private, loopback, link-local,
    multicast, or reserved address space. Defeats SSRF via DNS."""
    try:
        url = url.strip()
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        host = parsed.hostname
        if not host:
            return False
        # getaddrinfo returns all A/AAAA records — reject if ANY is unsafe
        infos = socket.getaddrinfo(host, None)
        for family, _type, _proto, _canon, sockaddr in infos:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if (ip.is_private or ip.is_loopback or ip.is_link_local
                    or ip.is_multicast or ip.is_reserved
                    or ip.is_unspecified):
                return False
        return True
    except Exception:
        return False


def is_valid_url(url):
    return _is_safe_remote_url(url)
```

**Note on TOCTOU:** A motivated attacker could exploit a DNS race
between our resolution and yt-dlp's. Acceptable for a personal
self-hosted tool. Production hardening would require a custom
`requests` adapter or `httpx` transport that pins the resolved IP.

### Verify

```bash
# Loopback rejected
curl -X POST localhost:8899/api/info \
  -H 'Content-Type: application/json' \
  -d '{"urls":["http://127.0.0.1:5432"]}'
# expect: [] (filtered out by is_valid_url before yt-dlp sees it)

# IMDS rejected
curl -X POST localhost:8899/api/info \
  -H 'Content-Type: application/json' \
  -d '{"urls":["http://169.254.169.254/latest/meta-data/"]}'
# expect: []

# Public URL still works
curl -X POST localhost:8899/api/info \
  -H 'Content-Type: application/json' \
  -d '{"urls":["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]}'
# expect: real info payload
```

---

## H1 — Auth token + bind host + rate limits

Three independent sub-fixes bundled for one commit because they all
configure how the Flask app is exposed.

### H1a — Bearer token (env-gated)

**Risk:** App binds `0.0.0.0:8899` with no authentication. Anyone
on the LAN (or anywhere, if port-forwarded) can hit `/api/download`.

**Patch — add to imports:**

```python
from functools import wraps
```

**Add after `logger = logging.getLogger(__name__)` (~line 17):**

```python
_AUTH_TOKEN = os.environ.get('RECLIP_AUTH_TOKEN')


def require_auth(view):
    """Bearer-token guard. Disabled (open) if RECLIP_AUTH_TOKEN unset."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not _AUTH_TOKEN:
            return view(*args, **kwargs)
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return jsonify({"error": "Unauthorized"}), 401
        token = header[len('Bearer '):].strip()
        # constant-time compare to avoid timing oracles
        import hmac
        if not hmac.compare_digest(token, _AUTH_TOKEN):
            return jsonify({"error": "Unauthorized"}), 401
        return view(*args, **kwargs)
    return wrapped
```

**Decorate routes** — add `@require_auth` immediately after each
`@app.route(...)` for `/api/cookies`, `/api/info`, `/api/download`.
Leave `/` (static index) un-gated so the SPA loads.

### H1b — Configurable bind host

**Replace `reclip.py:216`:**

```python
if __name__ == '__main__':
    host = os.environ.get('RECLIP_BIND_HOST', '127.0.0.1')
    port = int(os.environ.get('RECLIP_PORT', '8899'))
    app.run(host=host, port=port)
```

Default flips from `0.0.0.0` to `127.0.0.1`. Operators who need LAN
access set `RECLIP_BIND_HOST=0.0.0.0` explicitly (and should set
`RECLIP_AUTH_TOKEN` at the same time).

### H1c — Per-IP rate limits

**Add to `requirements.in` and `requirements.txt`:**

```
Flask-Limiter==3.8.0
```

(Check the latest stable version at install time; pin exact.)

**Add after `app = Flask(...)`:**

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],  # opt-in per-route, no global default
)
```

**Decorate routes:**

```python
@app.route('/api/cookies', methods=['POST', 'GET'])
@require_auth
@limiter.limit("12/hour", methods=['POST'])  # cookies POST is rare
def api_cookies():
    ...

@app.route('/api/info', methods=['POST'])
@require_auth
@limiter.limit("30/minute")
def api_info():
    ...

@app.route('/api/download', methods=['POST'])
@require_auth
@limiter.limit("6/minute")
def api_download():
    ...
```

### Verify

```bash
# No auth + token set → 401
RECLIP_AUTH_TOKEN=secret python reclip.py &
curl -X POST localhost:8899/api/info -H 'Content-Type: application/json' -d '{"urls":[]}'
# expect: 401

# With correct token → 200
curl -X POST localhost:8899/api/info \
  -H 'Authorization: Bearer secret' \
  -H 'Content-Type: application/json' \
  -d '{"urls":[]}'
# expect: 200 []

# Bind default is loopback
ss -tlnp | grep 8899
# expect: 127.0.0.1:8899 (not 0.0.0.0:8899)

# 7th rapid download request hits 429
for i in 1 2 3 4 5 6 7; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST localhost:8899/api/download \
    -H 'Authorization: Bearer secret' \
    -H 'Content-Type: application/json' \
    -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"mp4"}'
done
# expect: last value = 429
```

---

## Frontend follow-up

If `RECLIP_AUTH_TOKEN` is set, the React frontend needs to send the
header on each fetch. Add a `localStorage`-backed token field in the
settings UI; inject `Authorization: Bearer ${token}` into the fetch
wrapper. Out of scope for this PR.

---

## PRD acceptance criteria mapping

| AC | Item | Verified by |
|----|------|-------------|
| AC1 | format_id rejects selector operators | H3 curl test |
| AC2 | format_id ≤64 chars | regex `{1,64}` |
| AC3 | format_id allowed charset only | regex `[A-Za-z0-9+\-_/]` |
| AC4 | SSRF: loopback rejected | H2 curl test |
| AC5 | SSRF: link-local (IMDS) rejected | H2 curl test |
| AC6 | SSRF: private RFC1918 rejected | H2 curl test |
| AC7 | SSRF: public URLs still work | H2 positive test |
| AC8 | Auth: 401 without token (when set) | H1a curl test |
| AC9 | Auth: 200 with valid token | H1a curl test |
| AC10 | Auth: timing-safe compare | code review (`hmac.compare_digest`) |
| AC11 | Bind: default 127.0.0.1 | `ss -tlnp` |
| AC12 | Bind: override via env | manual |
| AC13 | Rate limit: /api/download 6/min | H1c curl loop |
| AC14 | Rate limit: /api/info 30/min | manual |
| AC15 | Backward-compat: no token = open (dev) | H1a behavior |

---

## Order of operations

1. Apply H3 (smallest, lowest risk)
2. Run app, smoke-test info+download endpoints, confirm no regression
3. Apply H2
4. Smoke-test with public URL (positive) and 127.0.0.1 URL (negative)
5. Apply H1a + H1b + H1c together (they share the import block edits)
6. Add `Flask-Limiter` pin to requirements.in + regenerate requirements.txt
7. Smoke-test all verifications above
8. Commit each H as its own commit on `feat/security-hardening-h1-h6`
9. Push and update PR description with new ACs verified
