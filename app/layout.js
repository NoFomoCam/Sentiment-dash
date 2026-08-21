import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const TITLE = 'Sentiment Reader';
const TAGLINE = 'Contrarian market sentiment for SPX / NDX — 11 indicators, one 0–100 score. Low = fear (buy), high = greed (sell). Auto-updated each weekday after the U.S. close.';

export const metadata = {
  metadataBase: new URL('https://sentimentreader.vercel.app'),
  title: {
    default: `${TITLE} · Contrarian SPX/NDX Sentiment`,
    template: `%s · ${TITLE}`,
  },
  description: TAGLINE,
  applicationName: TITLE,
  authors: [{ name: TITLE }],
  keywords: ['market sentiment', 'contrarian', 'fear and greed', 'SPX', 'NDX', 'VIX', 'put/call'],
  openGraph: {
    title: `${TITLE} — Contrarian SPX/NDX Sentiment`,
    description: 'One 0–100 score from 11 contrarian indicators. Low = fear/buy, high = greed/sell.',
    url: '/',
    siteName: TITLE,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} — Contrarian SPX/NDX Sentiment`,
    description: 'One 0–100 score from 11 contrarian indicators. Low = fear/buy, high = greed/sell.',
  },
};

export const viewport = {
  themeColor: '#0a0d14',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
