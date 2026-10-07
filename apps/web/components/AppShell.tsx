'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AccountMenu } from '@/components/AccountMenu';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { isNavActive, NAV_ITEMS } from '@/lib/nav';
import styles from '@/styles/shell.module.css';

type AppShellProps = {
  children: React.ReactNode;
  clerkReady: boolean;
};

export function AppShell({ children, clerkReady }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Primary">
        <div className={styles.sidebarInner}>
          <BrandMark className={styles.brandSlot} wordClassName={styles.brandText} />
          <nav className={styles.nav} aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.navLink}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={styles.footer}>
            {clerkReady ? (
              <AccountMenu />
            ) : (
              <Link href="/sign-in" className={styles.account}>
                <span className={styles.avatarFallback} aria-hidden="true">
                  K
                </span>
                <span className={styles.accountCopy}>
                  <span className={styles.accountName}>Sign in</span>
                  <span className={styles.accountHint}>Clerk keys required</span>
                </span>
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <div className={styles.main}>
        <div className={styles.mobileTop}>
          <BrandMark />
          <ThemeToggle />
        </div>
        <div className={styles.content} id="main">
          {clerkReady ? null : (
            <p className={styles.note} role="status">
              <strong>Clerk is not configured.</strong> Add{' '}
              <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> to{' '}
              <code>apps/web/.env.local</code>, then restart. The shell still runs so you can review
              the layout.
            </p>
          )}
          {children}
        </div>
      </div>
      <nav className={styles.dock} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={styles.dockLink}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon size={22} aria-hidden="true" />
              <span className={styles.dockLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
