import { NextResponse } from 'next/server';

import { joinWaitlist } from '@/modules/waitlist';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';

  if (!email) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const result = await joinWaitlist(email);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ alreadyJoined: result.alreadyJoined });
}
