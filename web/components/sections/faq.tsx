import * as React from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { Reveal } from '@/components/motion/reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BRAND, faqs } from '@/lib/content';

// lib/content.ts's faqs array is intentionally plain data (see its own
// header comment), so the app-name-to-wordmark swap happens here at render
// time instead of embedding a component reference in that data.
function withWordmark(text: string, wordmarkClassName?: string): React.ReactNode {
  const parts = text.split(BRAND.appName);
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {part}
      {index < parts.length - 1 ? <Wordmark className={wordmarkClassName} /> : null}
    </React.Fragment>
  ));
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
              <AccordionTrigger>{withWordmark(faq.question)}</AccordionTrigger>
              <AccordionContent>{withWordmark(faq.answer, 'text-foreground text-base')}</AccordionContent>
            </AccordionItem>
          ))}
          <AccordionItem value="Who built this?">
            <AccordionTrigger>Who built this?</AccordionTrigger>
            <AccordionContent>
              <Wordmark className="text-foreground text-base" /> is a product of{' '}
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
