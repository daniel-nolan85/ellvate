import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPageShell, LegalSection } from '@/components/legal/legal-page-shell';
import { BRAND } from '@/lib/content';

const title = `Terms of Service — ${BRAND.appName}`;
const description = `The terms that govern your use of ${BRAND.appName}.`;

export const metadata: Metadata = {
  title,
  description,
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'August 23, 2026';

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      lastUpdated={LAST_UPDATED}
      otherPolicy={{ href: '/privacy', label: 'Privacy Policy' }}
      title="Terms of Service"
    >
      <LegalSection id="acceptance" title="1. Acceptance of these terms">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of {BRAND.appName},
          an app for the {BRAND.community} community, provided by {BRAND.companyLegalName}{' '}
          (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By creating an account
          or using {BRAND.appName}, you agree to these Terms. If you don&rsquo;t agree,
          please don&rsquo;t use the app.
        </p>
      </LegalSection>

      <LegalSection id="the-service" title="2. What the app is">
        <p>
          {BRAND.appName} is a place for {BRAND.community} residents to talk with each
          other, find out what&rsquo;s happening locally, take part in neighborhood
          missions, discover local services, and raise issues with the HOA board through
          petitions. It&rsquo;s a community tool, not an official channel of the HOA board
          itself, and we don&rsquo;t guarantee any particular response or outcome from the
          board.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Your account">
        <p>
          You need an account to use most of {BRAND.appName}, created with your phone
          number or email address. You&rsquo;re responsible for keeping your sign-in
          secure, and for everything that happens under your account. Let us know right
          away if you think someone else has access to it.
        </p>
        <p>
          You must be at least 13 years old to use {BRAND.appName}. If we learn an account
          belongs to someone younger, we&rsquo;ll remove it.
        </p>
      </LegalSection>

      <LegalSection id="conduct" title="4. Community conduct">
        <p>{BRAND.appName} works because people are decent to each other on it. When using the app, you agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Harass, threaten, or demean another member.</li>
          <li>Post content that is illegal, defamatory, or deliberately false.</li>
          <li>Impersonate another person or misrepresent your affiliation with anyone.</li>
          <li>Post spam, or use the app to advertise unrelated products or services.</li>
          <li>Attempt to access another member&rsquo;s account, or interfere with the app&rsquo;s normal operation.</li>
        </ul>
        <p>
          Petitions specifically are a way to raise a genuine local issue with the HOA
          board — they must stay focused on the issue itself, not name or accuse specific
          board members or staff. A petition reaching its signature goal is a respectful
          request for the board&rsquo;s consideration, never a demand or a guarantee of any
          particular outcome or timeline. Petitions open once the community reaches 200
          members; from that point, each one needs signatures from 20% of the community to
          reach its goal, a number fixed the moment the petition starts so it doesn&rsquo;t
          change as the community grows.
        </p>
      </LegalSection>

      <LegalSection id="content" title="5. Your content">
        <p>
          You own the posts, comments, photos, and other content you create in{' '}
          {BRAND.appName}. By posting it, you grant us a license to display, distribute,
          and store it within the app so other members can see it — nothing more.
          You&rsquo;re responsible for making sure you have the right to post whatever you
          share.
        </p>
        <p>
          Content that other members have engaged with — for example, an event people have
          joined or a mission others are mid-progress on — may stay visible to the
          community even after you delete your account, but will no longer be attributed
          to your name.
        </p>
      </LegalSection>

      <LegalSection id="moderation" title="6. Moderation">
        <p>
          You can report content that violates these Terms, and mute another member to
          stop seeing their content in your own feeds. We review reports and may remove
          content, or suspend or terminate an account, at our discretion, for violating
          these Terms or for any conduct we reasonably believe is harmful to the
          community.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="7. Ending your account">
        <p>
          You can permanently delete your account at any time from your profile. We may
          also suspend or terminate your access to {BRAND.appName} if you violate these
          Terms. Either way, some information may be retained for a short period as
          described in our{' '}
          <Link href="/privacy" className="text-foreground underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="8. Disclaimers">
        <p>
          {BRAND.appName} is provided &ldquo;as is,&rdquo; without warranties of any kind.
          We don&rsquo;t verify the accuracy of content posted by members, including event
          details, service listings, or reviews, and we&rsquo;re not responsible for
          interactions between members that happen outside the app. Use your own judgment
          when meeting up with people or businesses you find through {BRAND.appName}.
        </p>
        <p>
          To the fullest extent permitted by law, {BRAND.companyLegalName} is not liable for any
          indirect, incidental, or consequential damages arising from your use of the app.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes to these terms">
        <p>
          We may update these Terms as {BRAND.appName} changes. If we make a material
          change, we&rsquo;ll update the date at the top of this page and, where
          appropriate, notify you in the app. Continuing to use the app after a change
          means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="10. Governing law">
        <p>
          These Terms are governed by the laws of the State of Nevada, USA, without regard
          to its conflict-of-law principles.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contact us">
        <p>
          Questions about these Terms? Reach us through the Contact Us page in the{' '}
          {BRAND.appName} app, or write to {BRAND.companyLegalName}.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
