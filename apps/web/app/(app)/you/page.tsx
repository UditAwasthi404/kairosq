import { User } from 'lucide-react';

import { PagePlaceholder } from '@/components/PagePlaceholder';

export const metadata = { title: 'You' };

export default function YouPage() {
  return (
    <PagePlaceholder
      icon={User}
      kicker="Account"
      title="You"
      description="Profile, appearance, and account."
      emptyTitle="Just the basics"
      emptyBody="Appearance sits with the navigation. The rest of your account will land here later."
    />
  );
}
