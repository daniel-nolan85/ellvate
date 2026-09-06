import type { Metadata } from 'next';
import Link from 'next/link';

import {
  LegalPageShell,
  LegalSection,
} from '@/components/legal/legal-page-shell';
import { BRAND } from '@/lib/content';

const title = `Community Guidelines — ${BRAND.appName}`;
const description = `How we expect neighbours to treat each other on ${BRAND.appName}.`;

export const metadata: Metadata = {
  title,
  description,
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'August 27, 2026';

export default function CommunityGuidelinesPage() {
  return (
    <LegalPageShell
      lastUpdated={LAST_UPDATED}
      otherPolicies={[
        { href: '/terms', label: 'Terms of Service' },
        { href: '/privacy', label: 'Privacy Policy' },
      ]}
      title="Community Guidelines"
    >
      <LegalSection id="why" title="Why these exist">
        <p>
          {BRAND.appName} only works if it feels like {BRAND.community} does in
          person — friendly, direct, and looking out for each other. These
          guidelines describe what that looks like in practice. They sit
          alongside our{' '}
          <Link
            className="text-foreground underline-offset-2 hover:underline"
            href="/terms"
          >
            Terms of Service
          </Link>
          , which cover the legal side of using the app.
        </p>
      </LegalSection>

      <LegalSection id="be-a-neighbour" title="Be a good neighbour">
        <p>
          Post the way you&rsquo;d talk to someone across the fence. Disagree
          with an idea without attacking the person who posted it. Assume good
          faith — most posts here are from someone trying to make the community
          better, find a recommendation, or just say hello.
        </p>
      </LegalSection>

      <LegalSection id="not-okay" title="What&rsquo;s not okay">
        <ul className="list-disc space-y-2 pl-5">
          <li>Harassing, threatening, or demeaning another member.</li>
          <li>Impersonating another person, a business, or an admin.</li>
          <li>
            Sharing someone else&rsquo;s private information without their
            consent.
          </li>
          <li>
            Spam, or using the app to advertise something unrelated to the
            community.
          </li>
          <li>
            Posting content that&rsquo;s illegal, deliberately false, or
            intended to mislead.
          </li>
        </ul>
        <p>
          Content like this gets removed when reported, and repeated or severe
          violations can lead to losing access to the app — see the Moderation
          section of our{' '}
          <Link
            className="text-foreground underline-offset-2 hover:underline"
            href="/terms"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="the-right-place" title="Post in the right place">
        <p>
          The forum is organized into channels — Announcements, HOA, Marina
          &amp; Boating, Golf, Trails, Dining, Sports Club, Buy &amp; Sell, and
          General — so neighbours can find what they&rsquo;re looking for
          without wading through everything else. Pick the channel that actually
          fits (General is there for anything genuinely topic-less), and keep
          Announcements and HOA for genuinely official or board-related
          information.
        </p>
      </LegalSection>

      <LegalSection id="reviews-and-petitions" title="Reviews and petitions">
        <p>
          Service reviews are for your own honest experience with a local
          business, not a place to settle a personal dispute or leave a review
          for a business you&rsquo;ve never actually used.
        </p>
        <p>
          Petitions are a respectful way to raise a real local issue with the
          HOA board. Keep a petition focused on the issue itself — not on naming
          or accusing specific board members or staff — and remember that
          reaching the signature goal means the board will consider it, not that
          any particular outcome is guaranteed.
        </p>
      </LegalSection>

      <LegalSection id="tools" title="Tools you have">
        <p>
          If a post bothers you, you don&rsquo;t have to just scroll past it:{' '}
          <strong className="text-foreground">Report</strong> flags it for our
          moderators, and <strong className="text-foreground">Block</strong>{' '}
          hides that member&rsquo;s posts, comments, events, missions, services,
          and petitions from you entirely — you can manage who you&rsquo;ve
          blocked, and unblock them, any time from your profile.
        </p>
        <p>
          A small &ldquo;Admin&rdquo; badge next to a member&rsquo;s name means
          their account is a genuine {BRAND.appName} admin — it&rsquo;s there so
          you can tell official content apart from someone imitating an admin.
          Anyone claiming to represent the HOA board or {BRAND.appName} without
          that mark should be reported.
        </p>
      </LegalSection>

      <LegalSection id="enforcement" title="Enforcement">
        <p>
          We review reports and act on them at our discretion — anything from
          removing a single post to suspending or terminating an account,
          depending on what happened and whether it&rsquo;s happened before.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these guidelines">
        <p>
          We may update these guidelines as the community grows. If we make a
          material change, we&rsquo;ll update the date at the top of this page.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Questions">
        <p>
          Questions about these guidelines? Reach us through the Contact Us page
          in the {BRAND.appName} app, or write to {BRAND.companyLegalName}.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
