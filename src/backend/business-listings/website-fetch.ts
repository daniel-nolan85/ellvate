// Fetches the business's own declared website for the verification
// classifier to actually read, rather than trusting a submitted URL string
// on its own -- see verification.ts's module comment for why a matching
// domain is no longer treated as sufficient by itself.
//
// This is a server-side fetch of a URL a stranger supplied, so it's written
// defensively against SSRF: only http/https, the hostname's resolved
// addresses are checked against private/loopback/link-local/reserved
// ranges (including the 169.254.169.254 cloud-metadata address) before the
// request is made, and the response is bounded in both time and size. This
// does not fully close a DNS-rebinding attack (an attacker's domain
// resolving to a public IP at check time but a private one when fetch()
// itself connects) -- an initial-resolution check plus a short timeout and
// no credentials/cookies sent is judged an acceptable tradeoff for fetching
// a business's own public marketing site, not a general-purpose proxy.

import { lookup } from 'node:dns/promises';

const FETCH_TIMEOUT_MS = 5_000;
// Bounds how much of the response body is read -- this only needs enough
// text for an LLM to judge "is this a real, local, appropriate business
// site," not a full page archive.
const MAX_RESPONSE_BYTES = 200_000;
// How much of the extracted text is actually sent to the classifier.
const MAX_SUMMARY_CHARS = 2_000;

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 || // "this network"
    a === 10 || // RFC1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, incl. 169.254.169.254 cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 192 && b === 168) || // RFC1918
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast (224-239) and reserved (240-255)
  );
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') {
    return true;
  }
  // IPv4-mapped addresses (::ffff:a.b.c.d) -- check the embedded IPv4.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized);
  if (mapped) {
    return isPrivateOrReservedIPv4(mapped[1]);
  }
  return (
    normalized.startsWith('fc') || // unique local (fc00::/7)
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') || // link-local (fe80::/10)
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

const isPrivateOrReservedIp = (ip: string): boolean =>
  ip.includes(':') ? isPrivateOrReservedIPv6(ip) : isPrivateOrReservedIPv4(ip);

async function isSafeToFetch(url: URL): Promise<boolean> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    return false;
  }
  try {
    const records = await lookup(hostname, { all: true });
    if (records.length === 0) {
      return false;
    }
    return records.every((record) => !isPrivateOrReservedIp(record.address));
  } catch {
    // Doesn't resolve -- treat as unsafe/unreachable rather than throwing,
    // so a nonexistent domain (e.g. a fabricated one) just reads as
    // "couldn't be reached" to the caller.
    return false;
  }
}

const stripHtml = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

export interface WebsiteFetchResult {
  readonly reachable: boolean;
  // A bounded, tag-stripped slice of the page's visible text, or null when
  // the site couldn't be reached/read at all.
  readonly summary: string | null;
}

const UNREACHABLE: WebsiteFetchResult = { reachable: false, summary: null };

// Best-effort: any failure (blocked by isSafeToFetch, DNS failure, timeout,
// non-2xx, non-HTML response) returns UNREACHABLE rather than throwing --
// the caller (verification.ts) treats that as a real, meaningful signal
// (a declared website that can't be reached is itself suspicious), not an
// error to propagate.
export async function fetchWebsiteSummary(rawUrl: string): Promise<WebsiteFetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return UNREACHABLE;
  }
  if (!(await isSafeToFetch(url))) {
    return UNREACHABLE;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'eLLVateBusinessVerificationBot/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return UNREACHABLE;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return UNREACHABLE;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return UNREACHABLE;
    }
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        void reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
    const text = stripHtml(html).slice(0, MAX_SUMMARY_CHARS);
    return text.length > 0 ? { reachable: true, summary: text } : { reachable: true, summary: null };
  } catch {
    return UNREACHABLE;
  } finally {
    clearTimeout(timeout);
  }
}
