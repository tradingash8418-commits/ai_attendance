import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MobileNav } from '@/components/MobileNav';

export const metadata: Metadata = {
  title: 'Contractor AI | Construction Workforce Management',
  description: 'AI-powered construction worker attendance & site management platform.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Contractor AI',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0f19',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#f4f5f7] text-slate-900 min-h-screen flex flex-col antialiased pb-16 md:pb-0">
        <Header />
        <main className="flex-grow flex flex-col">{children}</main>
        <Footer />
        <div className="md:hidden">
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
