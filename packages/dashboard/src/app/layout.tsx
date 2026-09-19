import type {Metadata} from 'next';
import './globals.css';
import { UserProvider } from '@/context/UserContext';
import { Navbar } from '@/components/Navbar';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'LetterForge | Forge Your Words',
  description: 'A fast-paced word game where you form words from random letters. Compete globally and climb the leaderboard!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. LanguageTool's
    // data-lt-installed, Grammarly) patch <html> attributes before React
    // hydrates. This silences only this element's attribute mismatches.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary/30 min-h-screen flex flex-col">
        <UserProvider>
          <Navbar />
          <main className="flex-grow">
            {children}
          </main>
          <Toaster />
        </UserProvider>
      </body>
    </html>
  );
}
