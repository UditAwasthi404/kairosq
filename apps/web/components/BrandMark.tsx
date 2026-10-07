import Link from 'next/link';

import styles from '@/styles/brand.module.css';

type BrandMarkProps = {
  href?: string;
  className?: string;
  wordClassName?: string;
};

export function BrandMark({ href = '/today', className, wordClassName }: BrandMarkProps) {
  return (
    <Link href={href} className={[styles.brand, className].filter(Boolean).join(' ')} aria-label="Kairos">
      {/* Light surfaces use the blue mark; dark surfaces use the light mark. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-dark.png" alt="" width={32} height={32} className={`${styles.mark} ${styles.markOnLight}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-light.png" alt="" width={32} height={32} className={`${styles.mark} ${styles.markOnDark}`} />
      <span className={[styles.word, wordClassName].filter(Boolean).join(' ')}>Kairos</span>
    </Link>
  );
}
