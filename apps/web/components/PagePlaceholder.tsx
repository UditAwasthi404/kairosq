import type { LucideIcon } from 'lucide-react';

import styles from '@/styles/page.module.css';

type PagePlaceholderProps = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
};

export function PagePlaceholder({
  icon: Icon,
  kicker,
  title,
  description,
  emptyTitle,
  emptyBody,
}: PagePlaceholderProps) {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>{kicker}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </header>
      <div className={styles.empty}>
        <div className={styles.iconWrap} aria-hidden="true">
          <Icon size={20} />
        </div>
        <h2 className={styles.emptyTitle}>{emptyTitle}</h2>
        <p className={styles.emptyBody}>{emptyBody}</p>
      </div>
    </section>
  );
}
