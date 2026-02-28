import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setSessionToken } from '@/lib/auth';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || 'demo@client.com').trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!user) {
    return new NextResponse(`User not found for email: ${email}`, { status: 404 });
  }

  await setSessionToken(user.id, user.role);

  return NextResponse.redirect(new URL('/app', request.url), 302);
}
