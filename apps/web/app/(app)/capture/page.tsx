import { Plus } from 'lucide-react';

import { PagePlaceholder } from '@/components/PagePlaceholder';

export const metadata = { title: 'Capture' };

export default function CapturePage() {
  return (
    <PagePlaceholder
      icon={Plus}
      kicker="Save"
      title="Capture"
      description="Write a thought, drop a link, or add a file."
      emptyTitle="Ready when you are"
      emptyBody="Capture stays quiet until the next phase wires it to Kairos."
    />
  );
}
