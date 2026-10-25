import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'SINC — Society for Innovation, Network & Collaboration',
  description: 'Enterprise networking, career development, and collaboration platform.'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
