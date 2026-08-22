import { About } from '@/components/sections/about';
import { AppPreview } from '@/components/sections/app-preview';
import { AssistantShowcase } from '@/components/sections/assistant-showcase';
import { Contact } from '@/components/sections/contact';
import { Faq } from '@/components/sections/faq';
import { FeatureDetail } from '@/components/sections/feature-detail';
import { FeatureOverview } from '@/components/sections/feature-overview';
import { Footer } from '@/components/sections/footer';
import { Hero } from '@/components/sections/hero';
import { Nav } from '@/components/sections/nav';
import { BRAND, faqs, features } from '@/lib/content';
import { SITE_URL } from '@/lib/site-url';

const standardFeatures = features.filter((feature) => feature.id !== 'assistant');
const assistantFeature = features.find((feature) => feature.id === 'assistant')!;

// Structured data (schema.org via JSON-LD) -- doesn't change what's
// rendered, but gives search engines an explicit, machine-readable read on
// what this page is (a software product, not just a wall of text) and lets
// the FAQ section qualify for Google's FAQ rich-result treatment in search
// results. See app/sitemap.ts / app/robots.ts for the other SEO basics.
function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MobileApplication',
        name: BRAND.appName,
        applicationCategory: 'SocialNetworkingApplication',
        operatingSystem: 'iOS, Android',
        description: `${BRAND.appName} brings ${BRAND.community} together in one app: forum discussions, an events calendar, neighborhood missions, a local services directory, and an AI assistant that knows the community.`,
        url: SITE_URL,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@type': 'Organization', name: BRAND.company, url: BRAND.companyUrl },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <Nav />
      <main>
        <Hero />
        <FeatureOverview />
        {standardFeatures.map((feature, index) => (
          <FeatureDetail key={feature.id} feature={feature} reversed={index % 2 === 1} />
        ))}
        <AssistantShowcase feature={assistantFeature} />
        <AppPreview />
        <About />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
