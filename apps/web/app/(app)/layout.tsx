import { AppShell } from '@/components/AppShell';
import { isClerkConfigured } from '@/lib/config';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell clerkReady={isClerkConfigured()}>{children}</AppShell>;
}
