import React from 'react';
import { BRAND } from '@/lib/brand';

export const metadata = {
  title: `${BRAND.shortName} — Partner with us to bring NEP to every school`,
  description: BRAND.description,
  openGraph: {
    title: `${BRAND.name}`,
    description: BRAND.description,
  },
};

export default function NepLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
