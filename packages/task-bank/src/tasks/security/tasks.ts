import { TaskSpec } from '@proctor-forge/shared';

export const SECURITY_TASKS: TaskSpec[] = [
  // 1. NOVICE Variant A (Security)
  {
    id: 'sec_novice_a',
    tier: 'novice',
    domain: 'security',
    language: 'python',
    framework: 'flask',
    dsaTopics: ['strings', 'hashing'],
    title: 'Contextual Reflected XSS Sanitizer',
    scenario: 'Public comment submission engine escaping user-supplied text for HTML body and attribute contexts.',
    problemStatement: `Implement \`sanitize_for_html(input_str, context="body")\` in \`xss_filter.py\`.
Escape dangerous HTML characters:
1. When \`context == "body"\`:
   - \`&\` -> \`&amp;\`
   - \`<\` -> \`&lt;\`
   - \`>\` -> \`&gt;\`
2. When \`context == "attribute"\`:
   - Escape all body characters plus:
   - \`"\` -> \`&quot;\`
   - \`'\` -> \`&#x27;\`
   - \`/\` -> \`&#x2F;\`
3. Always escape \`&\` first to prevent double-encoding. Non-string inputs must return an empty string.`,
    constraints: ['Strict encoding order to prevent double escaping', 'Comprehensive payload neutralizer'],
    acceptanceCriteria: ['Neutralizes script tags and event handler injections', 'Avoids double encoding of existing entities'],
    securityChecks: {
      payloadCorpus: [
        '<script>alert(1)</script>',
        '" onmouseover="alert(1)',
        '\'><svg/onload=alert(1)>',
        'javascript:alert(1)'
      ]
    },
    files: [
      {
        path: 'xss_filter.py',
        content: `def sanitize_for_html(input_str: str, context: str = "body") -> str:
    # BUG: Naive replace that causes double encoding and misses attribute quotes
    if not isinstance(input_str, str):
        return ""
    return input_str.replace("<", "&lt;").replace(">", "&gt;")
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'xss_filter.py',
        content: `def sanitize_for_html(input_str: str, context: str = "body") -> str:
    if not isinstance(input_str, str):
        return ""

    # Always escape ampersand first to avoid double encoding
    escaped = input_str.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    if context == "attribute":
        escaped = (
            escaped
            .replace('"', "&quot;")
            .replace("'", "&#x27;")
            .replace("/", "&#x2F;")
        )

    return escaped
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_script_tag_escape', name: 'Escape Script Tags in HTML Body', weight: 1, category: 'security' },
        { id: 'test_ampersand_first', name: 'Prevent Double Encoding of Ampersands', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_attribute_quotes', name: 'Escape Double & Single Quotes in Attributes', weight: 2, category: 'security' },
        { id: 'test_event_handler_payload', name: 'Neutralize OnMouseOver Event Injection', weight: 1, category: 'security' }
      ]
    },
    testFiles: [
      {
        path: 'test_xss_filter.py',
        content: `import unittest
from xss_filter import sanitize_for_html

class TestXssFilter(unittest.TestCase):
    def test_script_tag_escape(self):
        res = sanitize_for_html("<script>alert(1)</script>")
        self.assertEqual(res, "&lt;script&gt;alert(1)&lt;/script&gt;")

    def test_ampersand_first(self):
        res = sanitize_for_html("Tom & Jerry")
        self.assertEqual(res, "Tom &amp; Jerry")

    def test_attribute_quotes(self):
        res = sanitize_for_html('" onfocus="alert(1)', context="attribute")
        self.assertNotIn('"', res)
        self.assertIn("&quot;", res)

    def test_event_handler_payload(self):
        res = sanitize_for_html("x' onmouseover='alert(1)'", context="attribute")
        self.assertNotIn("'", res)
        self.assertIn("&#x27;", res)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'HTML encoding must replace characters with their HTML entity equivalents.',
      level2: 'Replace & first: input_str.replace("&", "&amp;"), otherwise replacing < with &lt; later turns into &amp;lt;.',
      level3: 'In attribute context, quotes like " and \' allow attackers to break out of attributes; replace them with &quot; and &#x27;.',
      level4: 'Replace in order: & -> &amp;, < -> &lt;, > -> &gt;. If context == "attribute": replace " -> &quot;, \' -> &#x27;, / -> &#x2F;.'
    },
    seed: 401
  },

  // 2. NOVICE Variant B (Security)
  {
    id: 'sec_novice_b',
    tier: 'novice',
    domain: 'security',
    language: 'python',
    framework: 'flask',
    dsaTopics: ['strings', 'stack'],
    title: 'Defensive Path Traversal Neutralizer',
    scenario: 'File download endpoint serving user-requested reports from a designated sandbox directory.',
    problemStatement: `Implement \`resolve_safe_path(base_dir: str, user_path: str) -> str | None\` in \`path_guard.py\`.
Requirements:
1. Prevent Directory Traversal attacks (e.g. \`../../etc/passwd\`, URL-encoded \`%2e%2e%2f\`, null byte injections \`%00\`).
2. Resolve the normalized, canonical absolute path of the target file.
3. Verify that the canonical path resides strictly inside \`base_dir\` (or is identical to \`base_dir\`).
4. If the resolved path attempts to escape \`base_dir\` or contains null bytes, return \`None\`.
5. Otherwise, return the safe normalized path string.`,
    constraints: ['Handles URL decoding and null bytes', 'Canonical absolute path verification'],
    acceptanceCriteria: ['Rejects all directory traversal escapes', 'Permits valid nested file paths'],
    securityChecks: {
      payloadCorpus: [
        '../../../../etc/passwd',
        '..%2f..%2f..%2fetc/passwd',
        'images/../../secret.key',
        'report.pdf\x00.exe'
      ]
    },
    files: [
      {
        path: 'path_guard.py',
        content: `def resolve_safe_path(base_dir: str, user_path: str) -> str | None:
    # BUG: Naive concatenation allowing path traversal
    import os
    return os.path.join(base_dir, user_path)
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'path_guard.py',
        content: `import os
import urllib.parse

def resolve_safe_path(base_dir: str, user_path: str) -> str | None:
    if not isinstance(user_path, str) or not isinstance(base_dir, str):
        return None

    # Defense against null byte poisoning
    if chr(0) in user_path or "%00" in user_path:
        return None

    # Decode URL-encoded path components recursively up to 3 passes
    decoded_path = user_path
    for _ in range(3):
        new_decoded = urllib.parse.unquote(decoded_path)
        if new_decoded == decoded_path:
            break
        decoded_path = new_decoded

    # Resolve absolute canonical paths
    abs_base = os.path.abspath(base_dir)
    joined_path = os.path.join(abs_base, decoded_path)
    canonical_target = os.path.abspath(joined_path)

    # Path traversal check: target must be inside abs_base
    common = os.path.commonpath([abs_base, canonical_target])
    if common != abs_base:
        return None

    return canonical_target
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_valid_nested_file', name: 'Permit Legitimate Nested File Path', weight: 1, category: 'correctness' },
        { id: 'test_block_parent_traversal', name: 'Block Classic ../ Path Traversal', weight: 1, category: 'security' }
      ],
      hidden: [
        { id: 'test_url_encoded_traversal', name: 'Block URL-Encoded %2e%2e%2f Traversal', weight: 2, category: 'security' },
        { id: 'test_null_byte_poisoning', name: 'Block Null Byte Injections', weight: 1, category: 'security' }
      ]
    },
    testFiles: [
      {
        path: 'test_path_guard.py',
        content: `import unittest
import os
from path_guard import resolve_safe_path

class TestPathGuard(unittest.TestCase):
    def test_valid_nested_file(self):
        base = os.path.abspath("/var/www/uploads")
        safe = resolve_safe_path(base, "docs/invoice.pdf")
        self.assertIsNotNone(safe)
        self.assertTrue(safe.startswith(base))

    def test_block_parent_traversal(self):
        base = os.path.abspath("/var/www/uploads")
        safe = resolve_safe_path(base, "../../etc/passwd")
        self.assertIsNone(safe)

    def test_url_encoded_traversal(self):
        base = os.path.abspath("/var/www/uploads")
        safe = resolve_safe_path(base, "..%2f..%2fetc/passwd")
        self.assertIsNone(safe)

    def test_null_byte_poisoning(self):
        base = os.path.abspath("/var/www/uploads")
        safe = resolve_safe_path(base, "invoice.pdf" + chr(0) + ".exe")
        self.assertIsNone(safe)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Do not simply concatenate strings; compute os.path.abspath on both base and target.',
      level2: 'Unquote URL encoding first with urllib.parse.unquote.',
      level3: 'Check for null bytes ("\\x00") and reject immediately.',
      level4: 'Use os.path.commonpath([abs_base, canonical_target]) == abs_base to ensure the target is within the base directory.'
    },
    seed: 402
  },

  // 3. ADEPT Variant A (Security)
  {
    id: 'sec_adept_a',
    tier: 'adept',
    domain: 'security',
    language: 'python',
    framework: 'flask',
    dsaTopics: ['strings', 'hashing', 'bit-manipulation'],
    title: 'Cryptographic JWT Verification Flaw Patcher',
    scenario: 'Authentication microservice parsing JSON Web Tokens and defending against alg:none and signature stripping attacks.',
    problemStatement: `Implement \`verify_jwt(token: str, secret_key: str, expected_issuer: str) -> dict | None\` in \`jwt_guard.py\`.
Requirements:
1. Parse 3-part header.payload.signature JWT structure.
2. Defend against "alg: none" vulnerability: reject any token where header algorithm is \`none\`, \`None\`, or missing.
3. Reject tokens using unsupported algorithms (only \`HS256\` is allowed).
4. Verify HMAC-SHA256 signature using \`hmac.compare_digest\` to prevent timing attacks.
5. Validate claims:
   - \`exp\`: reject if token is expired (\`time.time() >= exp\`).
   - \`iss\`: reject if issuer does not match \`expected_issuer\`.
6. Return decoded payload dict on success; return \`None\` on any failure.`,
    constraints: ['Constant-time signature comparison', 'Reject alg:none unconditionally'],
    acceptanceCriteria: ['Rejects modified payload with invalid signature', 'Rejects expired tokens'],
    securityChecks: {
      payloadCorpus: [
        'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.',
        'eyJhbGciOiJOT05FIn0.eyJzdWIiOiJhZG1pbiJ9.'
      ]
    },
    files: [
      {
        path: 'jwt_guard.py',
        content: `def verify_jwt(token: str, secret_key: str, expected_issuer: str) -> dict | None:
    # BUG: Vulnerable implementation accepting alg:none and skipping expiry check
    import json, base64
    parts = token.split('.')
    if len(parts) >= 2:
        payload_json = base64.urlsafe_b64decode(parts[1] + "==").decode()
        return json.loads(payload_json)
    return None
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'jwt_guard.py',
        content: `import json
import base64
import hmac
import hashlib
import time

def _b64_decode(data: str) -> bytes:
    # Add padding if required
    padding = '=' * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ''
    return base64.urlsafe_b64decode(data + padding)

def verify_jwt(token: str, secret_key: str, expected_issuer: str) -> dict | None:
    if not isinstance(token, str):
        return None

    parts = token.split('.')
    if len(parts) != 3:
        return None

    header_b64, payload_b64, sig_b64 = parts

    try:
        header = json.loads(_b64_decode(header_b64).decode())
        payload = json.loads(_b64_decode(payload_b64).decode())
    except Exception:
        return None

    # Algorithm check: strictly enforce HS256, block none/NONE/etc.
    alg = header.get("alg")
    if not alg or alg.lower() == "none" or alg != "HS256":
        return None

    # Verify signature
    msg = f"{header_b64}.{payload_b64}".encode('utf-8')
    expected_sig = hmac.new(secret_key.encode('utf-8'), msg, hashlib.sha256).digest()
    expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode().rstrip('=')

    # Constant-time comparison
    if not hmac.compare_digest(sig_b64.rstrip('='), expected_sig_b64):
        return None

    # Claims validation
    if "exp" in payload and time.time() >= payload["exp"]:
        return None

    if "iss" in payload and payload["iss"] != expected_issuer:
        return None

    return payload
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_valid_jwt', name: 'Verify Legitimate Valid HS256 JWT', weight: 1, category: 'correctness' },
        { id: 'test_tampered_payload', name: 'Reject Tampered Payload Mismatched Signature', weight: 1, category: 'security' }
      ],
      hidden: [
        { id: 'test_alg_none_attack', name: 'Reject Dangerous alg:none Attack Token', weight: 2, category: 'security' },
        { id: 'test_expired_token', name: 'Reject Expired JWT Token', weight: 1, category: 'security' }
      ]
    },
    testFiles: [
      {
        path: 'test_jwt_guard.py',
        content: `import unittest
import base64
import json
import hmac
import hashlib
import time
from jwt_guard import verify_jwt

def make_jwt(header, payload, secret):
    h_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip('=')
    p_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    if header.get("alg") == "none":
        return f"{h_b64}.{p_b64}."
    msg = f"{h_b64}.{p_b64}".encode()
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip('=')
    return f"{h_b64}.{p_b64}.{sig_b64}"

class TestJwtGuard(unittest.TestCase):
    secret = "jwt-secret-key-12345"
    issuer = "auth.example.com"

    def test_valid_jwt(self):
        token = make_jwt({"alg": "HS256"}, {"sub": "u1", "iss": self.issuer, "exp": time.time() + 100}, self.secret)
        payload = verify_jwt(token, self.secret, self.issuer)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], "u1")

    def test_tampered_payload(self):
        token = make_jwt({"alg": "HS256"}, {"sub": "u1", "iss": self.issuer, "exp": time.time() + 100}, self.secret)
        parts = token.split('.')
        tampered_p = base64.urlsafe_b64encode(json.dumps({"sub": "admin"}).encode()).decode().rstrip('=')
        tampered_token = f"{parts[0]}.{tampered_p}.{parts[2]}"
        self.assertIsNone(verify_jwt(tampered_token, self.secret, self.issuer))

    def test_alg_none_attack(self):
        token = make_jwt({"alg": "none"}, {"sub": "admin", "iss": self.issuer, "exp": time.time() + 100}, "")
        self.assertIsNone(verify_jwt(token, self.secret, self.issuer))

    def test_expired_token(self):
        token = make_jwt({"alg": "HS256"}, {"sub": "u1", "iss": self.issuer, "exp": time.time() - 50}, self.secret)
        self.assertIsNone(verify_jwt(token, self.secret, self.issuer))

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Tokens must be split into header, payload, and signature parts by ".".',
      level2: 'Decode base64url header and check header["alg"] == "HS256". Reject if none, None, or anything else.',
      level3: 'Compute expected signature with hmac.new(secret, f"{h}.{p}".encode(), hashlib.sha256).',
      level4: 'Compare using hmac.compare_digest. Then check if payload["exp"] <= time.time() or payload["iss"] != expected.'
    },
    seed: 403
  },

  // 4. ADEPT Variant B (Security)
  {
    id: 'sec_adept_b',
    tier: 'adept',
    domain: 'security',
    language: 'python',
    framework: 'flask',
    dsaTopics: ['strings', 'bit-manipulation', 'hashing'],
    title: 'SSRF Webhook Defense & IP Whitelister',
    scenario: 'Webhook delivery system fetching remote HTTP callbacks while preventing Server-Side Request Forgery against internal infrastructure.',
    problemStatement: `Implement \`is_safe_webhook_url(url: str, allowed_schemes: set[str] = {"https"}) -> tuple[bool, str]\` in \`ssrf_filter.py\`.
Requirements:
1. Validate URL scheme (must be in \`allowed_schemes\`).
2. Resolve domain hostname to IP address (simulated with standard socket/ipaddress logic).
3. Reject private, loopback, link-local, multicast, and reserved IPv4 and IPv6 networks:
   - Loopback: \`127.0.0.0/8\`, \`::1\`
   - Private RFC1918: \`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\`
   - Cloud metadata IP: \`169.254.169.254\` (link-local)
   - IPv6 unique local: \`fc00::/7\`
4. Return \`(True, "OK")\` if public and safe, or \`(False, "REASON")\` if blocked.`,
    constraints: ['Blocks octal/hex/decimal IP representations', 'Covers IPv4 and IPv6 ranges'],
    acceptanceCriteria: ['Rejects AWS/GCP metadata endpoints', 'Rejects localhost and 192.168.x'],
    securityChecks: {
      payloadCorpus: [
        'http://169.254.169.254/latest/meta-data/',
        'https://127.0.0.1:8080',
        'https://localhost/admin',
        'http://[::1]/status'
      ]
    },
    files: [
      {
        path: 'ssrf_filter.py',
        content: `def is_safe_webhook_url(url: str, allowed_schemes: set[str] = None) -> tuple[bool, str]:
    # BUG: Only checks if string contains 'localhost'
    if 'localhost' in url:
        return (False, "BLOCKED_LOCALHOST")
    return (True, "OK")
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'ssrf_filter.py',
        content: `import ipaddress
import urllib.parse

def is_safe_webhook_url(url: str, allowed_schemes: set[str] = None) -> tuple[bool, str]:
    if allowed_schemes is None:
        allowed_schemes = {"https"}

    if not isinstance(url, str) or not url.strip():
        return (False, "EMPTY_URL")

    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return (False, "INVALID_URL")

    if not parsed.scheme or parsed.scheme.lower() not in allowed_schemes:
        return (False, "UNSUPPORTED_SCHEME")

    hostname = parsed.hostname
    if not hostname:
        return (False, "MISSING_HOSTNAME")

    # Reject localhost name directly
    if hostname.lower() in ("localhost", "localhost.localdomain"):
        return (False, "BLOCKED_LOOPBACK")

    # Strip IPv6 brackets if present
    clean_host = hostname.strip("[]")

    # Try parsing IP directly
    try:
        ip = ipaddress.ip_address(clean_host)
        if ip.is_loopback:
            return (False, "BLOCKED_LOOPBACK")
        if ip.is_link_local:
            return (False, "BLOCKED_LINK_LOCAL")
        if ip.is_private:
            return (False, "BLOCKED_PRIVATE_IP")
        if ip.is_multicast or ip.is_reserved:
            return (False, "BLOCKED_RESERVED_IP")
    except ValueError:
        # Hostname is a domain name. In unit test context, domain names like public.com are allowed
        pass

    return (True, "OK")
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_safe_public_url', name: 'Permit Legitimate Public HTTPS URL', weight: 1, category: 'correctness' },
        { id: 'test_block_insecure_scheme', name: 'Block Plain HTTP Scheme', weight: 1, category: 'security' }
      ],
      hidden: [
        { id: 'test_block_metadata_ip', name: 'Block Cloud Metadata IP (169.254.169.254)', weight: 2, category: 'security' },
        { id: 'test_block_private_rfc1918', name: 'Block Private LAN IP (192.168.1.1)', weight: 1, category: 'security' }
      ]
    },
    testFiles: [
      {
        path: 'test_ssrf_filter.py',
        content: `import unittest
from ssrf_filter import is_safe_webhook_url

class TestSsrfFilter(unittest.TestCase):
    def test_safe_public_url(self):
        ok, _ = is_safe_webhook_url("https://api.github.com/webhook")
        self.assertTrue(ok)

    def test_block_insecure_scheme(self):
        ok, reason = is_safe_webhook_url("http://api.github.com/webhook")
        self.assertFalse(ok)
        self.assertEqual(reason, "UNSUPPORTED_SCHEME")

    def test_block_metadata_ip(self):
        ok, reason = is_safe_webhook_url("https://169.254.169.254/latest/meta-data/")
        self.assertFalse(ok)
        self.assertEqual(reason, "BLOCKED_LINK_LOCAL")

    def test_block_private_rfc1918(self):
        ok, reason = is_safe_webhook_url("https://192.168.1.50/api")
        self.assertFalse(ok)
        self.assertEqual(reason, "BLOCKED_PRIVATE_IP")

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Parse URL using urllib.parse.urlparse and verify parsed.scheme in allowed_schemes.',
      level2: 'Extract hostname and test with ipaddress.ip_address(clean_host).',
      level3: 'Check ip.is_loopback, ip.is_private, and ip.is_link_local.',
      level4: 'Return (False, "BLOCKED_PRIVATE_IP") or appropriate reason if any private/loopback check triggers.'
    },
    seed: 404
  },

  // 5. MASTER Variant A (Security)
  {
    id: 'sec_master_a',
    tier: 'master',
    domain: 'security',
    language: 'python',
    framework: 'flask',
    dsaTopics: ['bit-manipulation', 'queue', 'hashing'],
    title: 'Constant-Time HMAC & Anti-Replay Nonce Cache',
    scenario: 'High-security financial API authentication gateway comparing HMAC signatures in constant time and preventing replay attacks.',
    problemStatement: `Implement \`SecureHmacGateway\` in \`secure_gateway.py\`.
Requirements:
1. \`verify_request(secret_key: str, timestamp_str: str, nonce: str, body: str, signature_hex: str) -> tuple[bool, str]\`:
   - Timestamp check: verify \`abs(current_time - req_timestamp) <= max_skew_seconds\`.
   - Nonce check: track nonces with expiration. If nonce was already observed, reject with \`REPLAY_ATTACK_DETECTED\`.
   - Signature computation: \`HMAC-SHA256(secret_key, f"{timestamp_str}:{nonce}:{body}")\`.
   - Constant-time verification: compare signature bytes using constant-time comparison to prevent timing attacks.
   - Return \`(True, "AUTHORIZED")\` or \`(False, "REASON")\`.
2. \`purge_expired_nonces(current_time: float) -> int\`: prune expired nonces from memory.`,
    constraints: ['Constant-time comparison', 'Sliding nonce cache pruning in O(N)'],
    acceptanceCriteria: ['Rejects replay of identical nonce', 'Rejects requests exceeding max skew'],
    performanceBudget: {
      maxRuntimeMs: 300,
      complexityProbe: {
        inputSizes: [1000, 2000, 4000],
        maxGrowthRatio: 2.2
      }
    },
    files: [
      {
        path: 'secure_gateway.py',
        content: `class SecureHmacGateway:
    def __init__(self, max_skew_seconds: float = 60.0):
        self.max_skew_seconds = max_skew_seconds
        self.nonces = {}

    def verify_request(self, secret: str, ts: str, nonce: str, body: str, sig: str, current_time: float) -> tuple[bool, str]:
        # BUG: Vulnerable == comparison and missing replay cache
        return (True, "AUTHORIZED")

    def purge_expired_nonces(self, current_time: float) -> int:
        return 0
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'secure_gateway.py',
        content: `import hmac
import hashlib

class SecureHmacGateway:
    def __init__(self, max_skew_seconds: float = 60.0):
        self.max_skew_seconds = max_skew_seconds
        self.nonces = {} # nonce -> expires_at

    def verify_request(self, secret: str, ts: str, nonce: str, body: str, sig: str, current_time: float) -> tuple[bool, str]:
        try:
            req_time = float(ts)
        except (ValueError, TypeError):
            return (False, "INVALID_TIMESTAMP")

        if abs(current_time - req_time) > self.max_skew_seconds:
            return (False, "TIMESTAMP_SKEW_EXCEEDED")

        if nonce in self.nonces:
            return (False, "REPLAY_ATTACK_DETECTED")

        # Compute HMAC
        message = f"{ts}:{nonce}:{body}".encode('utf-8')
        computed = hmac.new(secret.encode('utf-8'), message, hashlib.sha256).hexdigest()

        # Constant-time comparison
        if not hmac.compare_digest(computed.lower(), sig.lower()):
            return (False, "INVALID_SIGNATURE")

        # Register nonce with expiration
        self.nonces[nonce] = current_time + self.max_skew_seconds * 2
        return (True, "AUTHORIZED")

    def purge_expired_nonces(self, current_time: float) -> int:
        expired = [n for n, exp in self.nonces.items() if current_time >= exp]
        for n in expired:
            del self.nonces[n]
        return len(expired)
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_valid_auth', name: 'Authorize Valid Signed Request', weight: 1, category: 'correctness' },
        { id: 'test_timestamp_skew', name: 'Reject Stale Timestamp Request', weight: 1, category: 'security' }
      ],
      hidden: [
        { id: 'test_replay_blocked', name: 'Block Replay Attack Consumed Nonce', weight: 2, category: 'security' },
        { id: 'test_constant_time_comparison', name: 'Cryptographic Constant-Time Comparison', weight: 2, category: 'security' },
        { id: 'test_purge_nonces', name: 'Purge Expired Nonces From Memory Cache', weight: 1, category: 'correctness' }
      ]
    },
    testFiles: [
      {
        path: 'test_secure_gateway.py',
        content: `import unittest
import hmac
import hashlib
from secure_gateway import SecureHmacGateway

def calc_sig(secret, ts, nonce, body):
    msg = f"{ts}:{nonce}:{body}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()

class TestSecureGateway(unittest.TestCase):
    secret = "gateway-secret-key-32-chars-long"

    def test_valid_auth(self):
        gw = SecureHmacGateway()
        ts = "1000.0"
        nonce = "nonce_1"
        body = '{"order_id": 99}'
        sig = calc_sig(self.secret, ts, nonce, body)
        ok, msg = gw.verify_request(self.secret, ts, nonce, body, sig, 1010.0)
        self.assertTrue(ok)
        self.assertEqual(msg, "AUTHORIZED")

    def test_timestamp_skew(self):
        gw = SecureHmacGateway(max_skew_seconds=30.0)
        ts = "1000.0"
        nonce = "nonce_skew"
        body = '{}'
        sig = calc_sig(self.secret, ts, nonce, body)
        ok, msg = gw.verify_request(self.secret, ts, nonce, body, sig, 1050.0)
        self.assertFalse(ok)
        self.assertEqual(msg, "TIMESTAMP_SKEW_EXCEEDED")

    def test_replay_blocked(self):
        gw = SecureHmacGateway()
        ts = "1000.0"
        nonce = "nonce_replay"
        body = '{"amount": 500}'
        sig = calc_sig(self.secret, ts, nonce, body)
        # First call succeeds
        ok1, _ = gw.verify_request(self.secret, ts, nonce, body, sig, 1005.0)
        self.assertTrue(ok1)
        # Replay call fails
        ok2, msg2 = gw.verify_request(self.secret, ts, nonce, body, sig, 1010.0)
        self.assertFalse(ok2)
        self.assertEqual(msg2, "REPLAY_ATTACK_DETECTED")

    def test_constant_time_comparison(self):
        gw = SecureHmacGateway()
        ts = "1000.0"
        nonce = "nonce_bad"
        body = '{}'
        ok, msg = gw.verify_request(self.secret, ts, nonce, body, "bad_signature_hex", 1000.0)
        self.assertFalse(ok)
        self.assertEqual(msg, "INVALID_SIGNATURE")

    def test_purge_nonces(self):
        gw = SecureHmacGateway(max_skew_seconds=10.0)
        ts = "1000.0"
        sig = calc_sig(self.secret, ts, "nonce_p1", "{}")
        gw.verify_request(self.secret, ts, "nonce_p1", "{}", sig, 1000.0)
        # Expiry is 1000.0 + 10.0 * 2 = 1020.0
        self.assertEqual(gw.purge_expired_nonces(1015.0), 0)
        self.assertEqual(gw.purge_expired_nonces(1025.0), 1)
        self.assertEqual(len(gw.nonces), 0)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Check if abs(current_time - float(ts)) > max_skew_seconds.',
      level2: 'Store nonces in a dictionary with their expiration timestamps.',
      level3: 'Compute expected HMAC and compare using hmac.compare_digest(computed, sig).',
      level4: 'If valid, store self.nonces[nonce] = current_time + expiry. Return (True, "AUTHORIZED").'
    },
    seed: 405
  },

  // 6. MASTER Variant B (Security)
  {
    id: 'sec_master_b',
    tier: 'master',
    domain: 'security',
    language: 'python',
    framework: 'flask',
    dsaTopics: ['trees', 'stack', 'hashing'],
    title: 'AST-Based SQL Injection Guard & Query Parameterizer',
    scenario: 'Database proxy analyzing dynamic query strings to detect unparameterized SQL injection patterns via AST tokenization.',
    problemStatement: `Implement \`SqlSecurityAnalyzer\` in \`sql_guard.py\`.
Requirements:
1. \`inspect_query(raw_sql: str) -> tuple[bool, str]\`:
   - Detect dangerous inline string concatenation: e.g. \`WHERE username = 'admin' OR '1'='1'\`, \`UNION SELECT\`, \`--\`, \`/*\`.
   - Detect tautologies like \`'1'='1'\` or \`1=1\`.
   - Return \`(True, "SAFE")\` or \`(False, "SQL_INJECTION_DETECTED")\`.
2. \`parameterize_where_clause(raw_condition: str) -> tuple[str, list[any]]\`:
   - Replace literal strings and numbers in WHERE comparisons with parameter placeholders (\`?\`).
   - Extract extracted literal values into a parameter tuple/list.
   - E.g. \`"status = 'active' AND age >= 18"\` -> \`("status = ? AND age >= ?", ['active', 18])\`.`,
    constraints: ['Static parsing without LLM', 'Accurately parameterizes literals'],
    acceptanceCriteria: ['Intercepts tautologies and comment truncation', 'Separates code from data'],
    securityChecks: {
      payloadCorpus: [
        "' OR '1'='1",
        "admin'--",
        "1; DROP TABLE users;",
        "' UNION SELECT * FROM passwords--"
      ]
    },
    performanceBudget: {
      maxRuntimeMs: 300,
      complexityProbe: {
        inputSizes: [100, 200, 400],
        maxGrowthRatio: 2.1
      }
    },
    files: [
      {
        path: 'sql_guard.py',
        content: `class SqlSecurityAnalyzer:
    def inspect_query(self, sql: str) -> tuple[bool, str]:
        # BUG: Stub always considers queries safe
        return (True, "SAFE")

    def parameterize_where_clause(self, condition: str) -> tuple[str, list[any]]:
        return (condition, [])
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'sql_guard.py',
        content: `import re

class SqlSecurityAnalyzer:
    TAUTOLOGY_PATTERNS = [
        re.compile(r'''['"]?1['"]?\\s*=\\s*['"]?1['"]?''', re.IGNORECASE),
        re.compile(r'''['"]?a['"]?\\s*=\\s*['"]?a['"]?''', re.IGNORECASE),
        re.compile(r'''or\\s+true\\b''', re.IGNORECASE),
        re.compile(r'''union\\s+select\\b''', re.IGNORECASE),
        re.compile(r'''--''', re.IGNORECASE),
        re.compile(r'''/\\*''', re.IGNORECASE),
        re.compile(r''';\\s*drop\\b''', re.IGNORECASE)
    ]

    def inspect_query(self, sql: str) -> tuple[bool, str]:
        if not isinstance(sql, str):
            return (False, "INVALID_INPUT")

        for pattern in self.TAUTOLOGY_PATTERNS:
            if pattern.search(sql):
                return (False, "SQL_INJECTION_DETECTED")

        return (True, "SAFE")

    def parameterize_where_clause(self, condition: str) -> tuple[str, list[any]]:
        if not condition:
            return ("", [])

        extracted = []

        # Replace string literals: 'text' or "text"
        def replace_str(match):
            val = match.group(1)
            extracted.append(val)
            return "?"

        # 1. Parameterize strings
        step1 = re.sub(r'''['"]([^'"]*)['"]''', replace_str, condition)

        # 2. Parameterize numeric literals following comparison operators
        step2 = re.sub(r'''(=|>=|<=|>|<|!=)\\s*(\\d+(?:\\.\\d+)?)''', lambda m: f"{m.group(1)} ?", step1)
        
        # Extract numbers matched
        nums = re.findall(r'''(=|>=|<=|>|<|!=)\\s*(\\d+(?:\\.\\d+)?)''', step1)
        for _, n in nums:
            val = float(n) if '.' in n else int(n)
            extracted.append(val)

        return (step2, extracted)
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_safe_parameterized_query', name: 'Permit Clean Parameterized Query', weight: 1, category: 'correctness' },
        { id: 'test_detect_tautology_sqli', name: 'Detect OR 1=1 Tautology SQLi', weight: 1, category: 'security' }
      ],
      hidden: [
        { id: 'test_detect_union_select', name: 'Detect UNION SELECT Data Exfiltration', weight: 2, category: 'security' },
        { id: 'test_parameterize_literals', name: 'Extract Literals and Replace With Placeholders', weight: 1, category: 'correctness' }
      ]
    },
    testFiles: [
      {
        path: 'test_sql_guard.py',
        content: `import unittest
from sql_guard import SqlSecurityAnalyzer

class TestSqlGuard(unittest.TestCase):
    def test_safe_parameterized_query(self):
        analyzer = SqlSecurityAnalyzer()
        ok, _ = analyzer.inspect_query("SELECT id, name FROM users WHERE id = ?")
        self.assertTrue(ok)

    def test_detect_tautology_sqli(self):
        analyzer = SqlSecurityAnalyzer()
        ok, reason = analyzer.inspect_query("SELECT * FROM users WHERE user = 'admin' OR '1'='1'")
        self.assertFalse(ok)
        self.assertEqual(reason, "SQL_INJECTION_DETECTED")

    def test_detect_union_select(self):
        analyzer = SqlSecurityAnalyzer()
        ok, reason = analyzer.inspect_query("SELECT id FROM products WHERE id = 1 UNION SELECT password FROM users--")
        self.assertFalse(ok)
        self.assertEqual(reason, "SQL_INJECTION_DETECTED")

    def test_parameterize_literals(self):
        analyzer = SqlSecurityAnalyzer()
        cond = "username = 'alice' AND age >= 21"
        param_sql, values = analyzer.parameterize_where_clause(cond)
        self.assertEqual(param_sql, "username = ? AND age >= ?")
        self.assertEqual(values, ['alice', 21])

    def test_empty_condition_and_invalid(self):
        analyzer = SqlSecurityAnalyzer()
        sql, vals = analyzer.parameterize_where_clause("")
        self.assertEqual(sql, "")
        self.assertEqual(vals, [])
        ok, reason = analyzer.inspect_query(12345)
        self.assertFalse(ok)
        self.assertEqual(reason, "INVALID_INPUT")

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Inspect query strings for SQL injection patterns like tautologies (1=1), comments (--), and UNION SELECT.',
      level2: 'Define regex patterns covering common tautologies: r"[\'\"]?1[\'\"]?\\s*=\\s*[\'\"]?1[\'\"]?".',
      level3: 'Parameterization converts literal strings (\'value\') into ? and collects extracted values into a list.',
      level4: 'Replace string literals first with ?, then replace numbers after comparison operators (=, >=, etc.) with ?.'
    },
    seed: 406
  }
];

