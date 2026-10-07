import { BookOpen } from 'lucide-react';

import { PagePlaceholder } from '@/components/PagePlaceholder';

export const metadata = { title: 'Library' };

export default function LibraryPage() {
  return (
    <PagePlaceholder
      icon={BookOpen}
      kicker="Memory"
      title="Library"
      description="Everything you have kept, in one place."
      emptyTitle="Your library is empty"
      emptyBody="Notes, links, and files will show up here once capture is connected."
    />
  );
}
