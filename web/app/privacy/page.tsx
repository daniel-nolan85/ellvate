import type { Metadata } from 'next';

import { LegalPageShell, LegalSection } from '@/components/legal/legal-page-shell';
import { BRAND } from '@/lib/content';

const title = `Privacy Policy — ${BRAND.appName}`;
const description = `How ${BRAND.appName} collects, uses, and protects your information.`;

export const metadata: Metadata = {
  title,
  description,
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'August 21, 2026';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      lastUpdated={LAST_UPDATED}
      otherPolicies={[
        { href: '/terms', label: 'Terms of Service' },
        { href: '/guidelines', label: 'Community Guidelines' },
      ]}
      title="Privacy Policy"
    >
      <LegalSection id="overview" title="Overview">
        <p>
          {BRAND.appName} is a community app for {BRAND.community}, built and operated by{' '}
          {BRAND.companyLegalName} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). This
          policy explains what information we collect when you use the app, how we use it,
          who we share it with, and the choices you have.
        </p>
        <p>
          We built {BRAND.appName} to run a small residential community, not to build a
          profile on you for advertising. We don&rsquo;t sell your information, and we
          don&rsquo;t show you third-party ads.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="Information we collect">
        <p>
          <strong className="text-foreground">Account information.</strong> When you sign
          up, we collect your phone number or email address (used to sign in via a one-time
          code) and the display name and profile photo you choose to add. We don&rsquo;t
          require or collect your real legal name, home address, or date of birth.
        </p>
        <p>
          <strong className="text-foreground">Content you create.</strong> Forum posts and
          comments, event and mission listings, service directory listings and reviews,
          petitions and petition comments, and any photos you attach to them. Visible to
          other members of the community unless you delete it or your account.
        </p>
        <p>
          <strong className="text-foreground">Activity within the app.</strong> Which
          events you&rsquo;ve joined, missions you&rsquo;ve completed, posts you&rsquo;ve
          liked or bookmarked, and your notification preferences — used to run those
          features and show you relevant activity.
        </p>
        <p>
          <strong className="text-foreground">Device and diagnostic information.</strong> A
          push-notification token (so we can deliver notifications you&rsquo;ve opted into),
          and automatically generated crash and error reports if the app encounters a bug.
          These reports may include device type, OS version, and the state of the app at the
          time of the crash — never your private messages or account credentials.
        </p>
        <p>
          We do not collect your precise location, and we do not use advertising trackers
          or third-party analytics SDKs.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use-it" title="How we use your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>To operate the core features of the app — forum, events, missions, services, petitions, and notifications.</li>
          <li>To let you sign in securely without managing a password.</li>
          <li>To respond when you contact us or report content.</li>
          <li>To diagnose and fix bugs, using crash and error reports.</li>
          <li>To keep the community safe — reviewing reported content, and enforcing our Terms of Service.</li>
        </ul>
      </LegalSection>

      <LegalSection id="sharing" title="Who we share it with">
        <p>
          We use a small number of service providers to run {BRAND.appName}. Each only
          receives the information it needs to do its job, and none are permitted to use
          your information for their own purposes:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Clerk</strong> — handles sign-in and
            authentication.
          </li>
          <li>
            <strong className="text-foreground">Supabase</strong> — hosts our database and
            stores uploaded photos.
          </li>
          <li>
            <strong className="text-foreground">Sentry</strong> — receives crash and error
            reports to help us fix bugs.
          </li>
          <li>
            <strong className="text-foreground">Resend</strong> — delivers transactional
            emails you&rsquo;ve triggered, such as a message sent through Contact Us or a
            petition reaching its signature goal.
          </li>
          <li>
            <strong className="text-foreground">Apple and Google</strong> — distribute the
            app through the App Store and Google Play, and deliver push notifications on
            their platforms.
          </li>
        </ul>
        <p>
          We will also disclose information if required by law, or to protect the rights,
          property, or safety of {BRAND.appName}, our members, or the public.
        </p>
        <p>We do not sell your personal information, to anyone, ever.</p>
      </LegalSection>

      <LegalSection id="your-choices" title="Your choices and rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Notification preferences</strong> — choose
            what you&rsquo;re notified about, any time, from your profile.
          </li>
          <li>
            <strong className="text-foreground">Muting</strong> — hide another
            member&rsquo;s content from your own feeds without notifying them.
          </li>
          <li>
            <strong className="text-foreground">Reporting</strong> — flag content that
            violates our Terms of Service for review.
          </li>
          <li>
            <strong className="text-foreground">Account deletion</strong> — permanently
            delete your account and everything you&rsquo;ve posted, directly from your
            profile, at any time. This can&rsquo;t be undone. Content you created that
            other members are actively participating in, such as an event people have
            joined, stays up for the community but is no longer attributed to your name.
          </li>
          <li>
            <strong className="text-foreground">Data requests</strong> — to ask what
            information we hold about you, or to request a copy of it, reach us through the
            Contact Us page in the app.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep your information">
        <p>
          We keep your account information and content for as long as your account is
          active. If you delete your account, we permanently delete your profile and
          content within a reasonable period, except where a copy is kept for a short time
          in backups or where content you created remains genuinely useful to the
          community (see Account deletion above).
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children's privacy">
        <p>
          {BRAND.appName} is not directed at children, and we don&rsquo;t knowingly collect
          information from anyone under 13. If you believe a child has provided us with
          personal information, contact us and we&rsquo;ll remove it.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          We use industry-standard safeguards — encrypted connections, access controls, and
          row-level security on our database — to protect your information. No system is
          perfectly secure, but we take reasonable steps to protect what you share with us.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We may update this policy as {BRAND.appName} changes. If we make a material
          change, we&rsquo;ll update the date at the top of this page and, where
          appropriate, notify you in the app.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <p>
          Questions about this policy, or a data request? Reach us through the Contact Us
          page in the {BRAND.appName} app, or write to {BRAND.companyLegalName}.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
