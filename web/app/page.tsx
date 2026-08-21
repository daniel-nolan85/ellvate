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
import { features } from '@/lib/content';

const standardFeatures = features.filter((feature) => feature.id !== 'assistant');
const assistantFeature = features.find((feature) => feature.id === 'assistant')!;

export default function LandingPage() {
  return (
    <>
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
