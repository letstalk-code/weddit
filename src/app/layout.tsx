import type { Metadata } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
});

export const metadata: Metadata = {
  title: 'WEDDIT - Premium Filmmaker Tool',
  description: 'AI-powered story assistant for high-end wedding filmmakers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${instrument.variable} bg-brand-bg text-brand-text font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
