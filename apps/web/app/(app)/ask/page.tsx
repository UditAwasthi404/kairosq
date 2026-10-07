import { MessageCircle } from 'lucide-react';

import { PagePlaceholder } from '@/components/PagePlaceholder';

export const metadata = { title: 'Ask' };

export default function AskPage() {
  return (
    <PagePlaceholder
      icon={MessageCircle}
      kicker="Ask"
      title="Ask"
      description="Questions over your own memories."
      emptyTitle="No conversations yet"
      emptyBody="Ask will live here once it can reach your library."
    />
  );
}
