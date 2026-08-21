import { Reveal } from '@/components/motion/reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BRAND, faqs, founders } from '@/lib/content';

function FounderLink({ founder }: { founder: (typeof founders)[number] }) {
  return (
    <a
      href={founder.linkedin}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${founder.fullName} on LinkedIn`}
      className="font-medium text-accent underline-offset-2 hover:underline"
    >
      {founder.firstName}
    </a>
  );
}

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
              {BRAND.appName} is built by <FounderLink founder={founders[0]} /> and{' '}
              <FounderLink founder={founders[1]} /> of {BRAND.company}.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Reveal>
    </section>
  );
}
