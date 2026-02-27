import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

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
      <body className={`${inter.variable} ${playfair.variable} bg-[#0A0B10] text-[#E2E4E9] font-sans antialiased`} style={{ background: '#0A0B10' }}>
        {children}
      </body>
    </html>
  );
}
