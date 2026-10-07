import { ClerkProvider } from '@clerk/nextjs';

import { clerkPublishableKey, isClerkConfigured } from '@/lib/config';

export function ClerkRoot({ children }: { children: React.ReactNode }) {
  const publishableKey = clerkPublishableKey();
  if (!isClerkConfigured() || !publishableKey) {
    return children;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/today"
      signUpFallbackRedirectUrl="/today"
      appearance={{
        variables: {
          colorPrimary: '#D71921',
          fontFamily: 'Roboto, sans-serif',
          borderRadius: '16px',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
