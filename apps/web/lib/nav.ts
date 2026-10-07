import { BookOpen, MessageCircle, Plus, Sun, User, type LucideIcon } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/library', label: 'Library', icon: BookOpen },
  { href: '/capture', label: 'Capture', icon: Plus },
  { href: '/ask', label: 'Ask', icon: MessageCircle },
  { href: '/you', label: 'You', icon: User },
];

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
