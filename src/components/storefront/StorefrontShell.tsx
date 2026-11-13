'use client';

import React from 'react';
import { Header } from './Header';
import { CartDrawer } from './CartDrawer';
import { Footer } from './Footer';

export function StorefrontShell({
  children,
  showHeader = true,
  showFooter = true,
}: {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {showHeader && <Header />}
      <CartDrawer />
      <main className="flex-1">{children}</main>
      {showFooter && <Footer />}
    </div>
  );
}

