import { ReadingPage, RdSection, RdProse, RdCode, tocNumber } from '@/components/landing/Reading';
import { marketplaceStaffGate, providerPageMetadata } from '@/lib/provider-gate';

/**
 * The router signature (Phase 3 plan §8.6): how a listed host verifies that a request came through the Smart
 * Router, with Node and Python verifiers. Published at the opening (M10); until then shown only to accounts the API
 * lets into the provider pages, the site's 404 for everyone else, never indexed.
 */
const PATH = '/inference-providers/router-signature';
// The page's lead, and from the opening its description too (fix round, code review m9: the same words, nothing new).
const LEAD = "Every request the Smart Router sends to a listed host carries a signature the host can check with our public keys.";
export const generateMetadata = providerPageMetadata(PATH, 'The router signature', LEAD);
export const dynamic = 'force-dynamic';

const TOC = [
  { id: 'format', label: 'The header' },
  { id: 'verify', label: 'How to verify it' },
  { id: 'node', label: 'Node' },
  { id: 'python', label: 'Python' },
];
const n = (id: string) => tocNumber(TOC, id);

const HEADER = `ASL-Router-Signature: v=1; kid=2026-11; t=1762351200; rid=r_8f3k2l9q; bh=<base64url sha256 of the exact body bytes>; sig=<base64url Ed25519>

signed string = "asl-router-v1\\n{kid}\\n{t}\\n{rid}\\n{host}\\n{METHOD} {path}\\n{bh}"`;

const NODE = `const crypto = require('crypto');

// keys: the "keys" array of https://aistupidlevel.info/.well-known/asl-router-keys.json
function verify(req, rawBody, keys, myHost) {
  const h = Object.fromEntries(String(req.headers['asl-router-signature'] || '').split(';')
    .map(s => s.trim().split('=')).filter(p => p.length === 2));
  const key = keys.find(k => k.kid === h.kid);
  const now = Math.floor(Date.now() / 1000);
  if (h.v !== '1' || !key || now < key.not_before || now > key.not_after) return false;
  if (Math.abs(now - Number(h.t)) > 300) return false;
  const bh = crypto.createHash('sha256').update(rawBody).digest('base64url');
  if (bh !== h.bh) return false;
  const signed = ['asl-router-v1', h.kid, h.t, h.rid, myHost, \`\${req.method} \${req.url}\`, h.bh].join('\\n');
  const pub = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key.x }, format: 'jwk' });
  return crypto.verify(null, Buffer.from(signed), pub, Buffer.from(h.sig, 'base64url'));
}`;

const PYTHON = `import base64, hashlib, time
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

def b64u(s): return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))

def verify(method, path, raw_body, header, keys, my_host):
    h = dict(p.strip().split('=', 1) for p in header.split(';') if '=' in p)
    key = next((k for k in keys if k['kid'] == h.get('kid')), None)
    now = int(time.time())
    if h.get('v') != '1' or not key or not key['not_before'] <= now <= key['not_after']:
        return False
    if abs(now - int(h['t'])) > 300:
        return False
    bh = base64.urlsafe_b64encode(hashlib.sha256(raw_body).digest()).rstrip(b'=').decode()
    if bh != h['bh']:
        return False
    signed = '\\n'.join(['asl-router-v1', h['kid'], h['t'], h['rid'], my_host, f'{method} {path}', h['bh']])
    try:
        Ed25519PublicKey.from_public_bytes(b64u(key['x'])).verify(b64u(h['sig']), signed.encode())
        return True
    except Exception:
        return False`;

export default async function RouterSignaturePage() {
  const { preview } = await marketplaceStaffGate(PATH);
  return (
    <ReadingPage
      className="rd-router-signature"
      kicker="For inference providers"
      title="The router signature"
      lead={LEAD}
      note={preview ? 'Not public yet: only staff accounts can open this page.' : undefined}
      toc={TOC}
    >
      <RdSection id="format" n={n('format')} title="The header">
        <RdCode title="ASL-Router-Signature" label="format" code={HEADER} />
        <RdProse>
          <p>It carries no user, account or key identifier: you know your customer from the API key. Benchmark runs and readiness checks never carry it. The public keys are published at <code>/.well-known/asl-router-keys.json</code> as <code>{'{ keys: [{ kid, alg: "Ed25519", x, not_before, not_after }] }'}</code>, and are rotated every 6 months with 30 days of overlap.</p>
        </RdProse>
      </RdSection>
      <RdSection id="verify" n={n('verify')} title="How to verify it">
        <RdProse>
          <ol>
            <li><code>kid</code> is in the published keys file, and now lies between its <code>not_before</code> and <code>not_after</code>;</li>
            <li>|now − t| is at most 300 seconds;</li>
            <li>the host and the path are your own;</li>
            <li>the body hash matches the exact body bytes;</li>
            <li>the Ed25519 signature is valid;</li>
            <li>optionally, <code>rid</code> is seen only once in 10 minutes.</li>
          </ol>
        </RdProse>
      </RdSection>
      <RdSection id="node" n={n('node')} title="Node">
        <RdCode title="verify.js" label="Node 18+" code={NODE} />
      </RdSection>
      <RdSection id="python" n={n('python')} title="Python">
        <RdCode title="verify.py" label="Python 3 with cryptography" code={PYTHON} />
      </RdSection>
    </ReadingPage>
  );
}
