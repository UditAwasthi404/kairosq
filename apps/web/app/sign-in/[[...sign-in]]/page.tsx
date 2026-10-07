import { SignIn } from '@clerk/nextjs';

import { MissingClerkConfig } from '@/components/MissingClerkConfig';
import { isClerkConfigured } from '@/lib/config';
import styles from '@/styles/auth.module.css';

export const metadata = {
  title: 'Sign in',
};

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return <MissingClerkConfig />;
  }

  return (
    <main className={styles.frame}>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </main>
  );
}
