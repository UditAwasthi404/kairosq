import Link from 'next/link';

import { BrandMark } from '@/components/BrandMark';
import styles from '@/styles/auth.module.css';

export function MissingClerkConfig() {
  return (
    <main className={styles.frame}>
      <div className={styles.panel}>
        <BrandMark href="/" />
        <div className={styles.message}>
          <h1>Clerk keys are missing</h1>
          <p>
            Kairos web can build without them, but sign-in stays off until both keys are set.
            Copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code> and fill in:
          </p>
          <ul>
            <li>
              <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
            </li>
            <li>
              <code>CLERK_SECRET_KEY</code>
            </li>
            <li>
              <code>NEXT_PUBLIC_API_URL</code>
            </li>
          </ul>
        </div>
        <Link className={styles.back} href="/today">
          Back to Kairos
        </Link>
      </div>
    </main>
  );
}
