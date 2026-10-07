import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { isClerkConfigured } from '@/lib/config';

export default async function HomePage() {
  if (!isClerkConfigured()) {
    redirect('/today');
  }

  const { userId } = await auth();
  redirect(userId ? '/today' : '/sign-in');
}
