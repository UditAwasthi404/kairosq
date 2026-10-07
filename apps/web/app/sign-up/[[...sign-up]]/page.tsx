import { SignUp } from '@clerk/nextjs';

import { MissingClerkConfig } from '@/components/MissingClerkConfig';
import { isClerkConfigured } from '@/lib/config';
import styles from '@/styles/auth.module.css';

export const metadata = {
  title: 'Sign up',
};

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return <MissingClerkConfig />;
  }

  return (
    <main className={styles.frame}>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </main>
  );
}
