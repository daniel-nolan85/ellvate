// One-shot Claude classification call used by the business-listing
// verification pipeline's assisted tier (create.ts) when the deterministic
// domain-match check (clerk/clerk-client.ts + validation.ts's domain
// helpers) can't resolve a listing on its own.
//
// Deliberately NOT part of assistant/orchestrator.ts: that module is a
// multi-turn, tool-using conversational loop: this is a single structured
// JSON verdict with no tools and no conversation, a genuinely different
// call shape. It reuses the same raw-fetch-to-Anthropic pattern and model
// as the orchestrator, just with its own constants and its own (much
// smaller) system prompt.
//
// Authority is deliberately bounded: this function can only ever *clear* a
// listing (verdict 'confident'), never accidentally clear one by erroring.
// Any parse failure, timeout, non-2xx response, or missing API key returns
// null, and the caller treats null exactly like an explicit 'uncertain'
// verdict -- fail closed into the admin queue, never fail open into
// auto-verify.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const MAX_OUTPUT_TOKENS = 400;
const UPSTREAM_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT =
  'You are screening a submitted business-directory listing for the eLLVate community app. ' +
  'Decide whether this plausibly describes a real, currently operating local business, submitted by someone with a legitimate connection to it -- not spam, not a prank, not someone listing a business they do not run. ' +
  'You are NOT verifying legal ownership or franchise rights, only screening for obvious fakes, spam, and clearly implausible submissions. ' +
  'Respond with ONLY a JSON object matching this exact shape, no other text: {"verdict": "confident" | "uncertain", "reasoning": string}. ' +
  'Use "confident" only when nothing about the listing is suspicious. ' +
  'Default to "uncertain" whenever anything gives you pause -- being wrong in the uncertain direction costs a human a few seconds of review; being wrong in the confident direction publishes an unverified claim to the whole community.';

export interface VerificationClassifierInput {
  readonly businessName: string;
  readonly category: string;
  readonly description: string;
  readonly contactWebsite: string | null;
  readonly contactEmail: string | null;
  readonly photoUrl: string | null;
}

export interface VerificationVerdict {
  readonly verdict: 'confident' | 'uncertain';
  readonly reasoning: string;
}

interface AnthropicContentBlock {
  readonly type: string;
  readonly text?: string;
}

interface AnthropicMessageResponse {
  readonly content?: readonly AnthropicContentBlock[];
}

function buildUserContent(input: VerificationClassifierInput) {
  const lines = [
    `Business name: ${input.businessName}`,
    `Category: ${input.category}`,
    `Description: ${input.description}`,
    `Website: ${input.contactWebsite ?? '(none provided)'}`,
    `Contact email: ${input.contactEmail ?? '(none provided)'}`,
  ];
  const content: Record<string, unknown>[] = [{ type: 'text', text: lines.join('\n') }];
  if (input.photoUrl) {
    content.push({ type: 'image', source: { type: 'url', url: input.photoUrl } });
  }
  return content;
}

function parseVerdict(content: readonly AnthropicContentBlock[]): VerificationVerdict | null {
  const text = content.find((block) => block.type === 'text')?.text;
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as Partial<VerificationVerdict>;
    if (parsed.verdict === 'confident' || parsed.verdict === 'uncertain') {
      return { verdict: parsed.verdict, reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '' };
    }
    return null;
  } catch {
    return null;
  }
}

// Returns null (treat as 'uncertain') if ANTHROPIC_API_KEY isn't
// configured, the request times out, the upstream call fails, or the
// response can't be parsed into a valid verdict.
export async function classifyBusinessListing(
  input: VerificationClassifierInput,
): Promise<VerificationVerdict | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserContent(input) }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as AnthropicMessageResponse;
    return parseVerdict(data.content ?? []);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
