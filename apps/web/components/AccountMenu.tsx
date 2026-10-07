'use client';

import { UserButton, useUser } from '@clerk/nextjs';

import styles from '@/styles/shell.module.css';

export function AccountMenu() {
  const { user } = useUser();
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Account';

  return (
    <div className={styles.account}>
      <UserButton />
      <span className={styles.accountCopy}>
        <span className={styles.accountName}>{name}</span>
        <span className={styles.accountHint}>Signed in</span>
      </span>
    </div>
  );
}
