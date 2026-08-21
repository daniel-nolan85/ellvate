import { NextResponse } from 'next/server';

import { sendContactMessage } from '@/modules/contact';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name : '';
  const email = typeof body?.email === 'string' ? body.email : '';
  const subject = typeof body?.subject === 'string' ? body.subject : '';
  const message = typeof body?.message === 'string' ? body.message : '';

  const result = await sendContactMessage({ name, email, subject, message });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
