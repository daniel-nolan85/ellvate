import { Reveal } from '@/components/motion/reveal';
import { ContactForm } from '@/modules/contact';

export function Contact() {
  return (
    <section id="contact" className="border-t border-border/60 bg-surface-subtle/50">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <Reveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Get in touch</h2>
          <p className="mt-4 text-muted-foreground">
            Questions, feedback, or an idea for a feature — we&apos;d like to hear it.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10 rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
          <ContactForm />
        </Reveal>
      </div>
    </section>
  );
}
