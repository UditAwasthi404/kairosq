import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { ClerkRoot } from '@/components/ClerkRoot';
import { themeBootScript } from '@/lib/theme';
import '@/styles/global.css';

// Google's current Roboto Latin file is a single variable font. next/font/google
// crashes while parsing that CSS in Next 15.5, so the file is vendored here.
const roboto = localFont({
  src: '../fonts/roboto-latin.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-roboto',
  adjustFontFallback: 'Arial',
});

export const metadata: Metadata = {
  title: {
    default: 'Kairos',
    template: '%s · Kairos',
  },
  description: 'Kairos on the web.',
  icons: {
    icon: '/favicon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={roboto.className}>
        <ClerkRoot>{children}</ClerkRoot>
      </body>
    </html>
  );
}
