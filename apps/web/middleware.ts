import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/today(.*)',
  '/library(.*)',
  '/capture(.*)',
  '/ask(.*)',
  '/you(.*)',
]);

const protectWithClerk = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!publishable || !secret) {
    return NextResponse.next();
  }
  return protectWithClerk(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
