import { Reveal } from '@/components/motion/reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BRAND, faqs } from '@/lib/content';

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
          <AccordionItem value="Who built this?">
            <AccordionTrigger>Who built this?</AccordionTrigger>
            <AccordionContent>
              {BRAND.appName} is a product of{' '}
              <a
                href={BRAND.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                {BRAND.companyLegalName}
              </a>
              .
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Reveal>
    </section>
  );
}
