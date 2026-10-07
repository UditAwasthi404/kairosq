import { Sun } from 'lucide-react';

import { PagePlaceholder } from '@/components/PagePlaceholder';

export const metadata = { title: 'Today' };

export default function TodayPage() {
  return (
    <PagePlaceholder
      icon={Sun}
      kicker="Home"
      title="Today"
      description="A quiet view of what you captured and what matters now."
      emptyTitle="Nothing here yet"
      emptyBody="Memories you save will gather on Today."
    />
  );
}
