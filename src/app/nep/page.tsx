'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap,
  Building2,
  Users,
  BarChart3,
  ShieldCheck,
  MapPin,
  School,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { useNepAttribution } from '@/hooks/useNepAttribution';
import { SchoolInterestForm } from '@/components/nep/school-interest-form';

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'NEP 2020 aligned',
    desc: 'Onboard schools onto a curriculum and assessment framework built around the National Education Policy.',
  },
  {
    icon: Building2,
    title: 'Associations at every level',
    desc: 'Connect National, State, and District associations with the schools in their region.',
  },
  {
    icon: Users,
    title: 'Master, Sub & Partners',
    desc: 'A clear partner hierarchy spanning National, State, and District operations.',
  },
  {
    icon: BarChart3,
    title: 'Live tracking & analytics',
    desc: 'Every visit, click, and onboarding is attributed to the right partner automatically.',
  },
];

const PARTNER_TIERS = [
  { name: 'Master Partner', level: 'National Level', desc: 'Full visibility across all states, districts, and partners.' },
  { name: 'Sub Partner', level: 'State Level', desc: 'Manage assigned states, districts, and the partners within them.' },
  { name: 'Partner', level: 'District Level', desc: 'Manage your own leads, schools, and onboarding tracking.' },
];

export default function NepLandingPage() {
  const { attribution, track } = useNepAttribution();

  const handleCta = (cta: string) => track('cta_click', { campaign: cta });

  const handleSchoolSubmit = async (data: {
    schoolName: string;
    schoolBoard: string;
    state: string;
    district: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  }) => {
    await track('school_interest', data);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <School className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">{BRAND.shortName}</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login" onClick={() => handleCta('header_login')}>
              <Button variant="ghost" size="sm">
                Partner login
              </Button>
            </Link>
            <a href="#register-school" onClick={() => handleCta('header_register')}>
              <Button size="sm">Register school</Button>
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col gap-6">
            {attribution?.partner_id && (
              <Badge variant="secondary" className="w-fit gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Referred by partner {attribution.partner_id}
              </Badge>
            )}
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Bring the New Education Policy to every school in your region
            </h1>
            <p className="text-pretty text-lg text-muted-foreground">
              {BRAND.name} connects Master Partners, Sub Partners, and Partners
              with schools and associations across National, State, and District
              levels — with full referral tracking built in.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#register-school" onClick={() => handleCta('hero_register')}>
                <Button size="lg" className="gap-2">
                  Onboard your school
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Link href="/register" onClick={() => handleCta('hero_become_partner')}>
                <Button size="lg" variant="outline">
                  Become a partner
                </Button>
              </Link>
            </div>
            {(attribution?.state || attribution?.level) && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {[attribution?.level, attribution?.state, attribution?.district]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
          <div className="relative">
            <img
              src="/images/nep-hero.png"
              alt="Students and a teacher collaborating in a modern classroom"
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-balance text-3xl font-bold tracking-tight">
              One platform for partners, schools, and associations
            </h2>
            <p className="mt-2 text-muted-foreground">
              Everything you need to grow NEP adoption and track it accurately.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border">
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partner hierarchy */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-balance text-3xl font-bold tracking-tight">
              A partner hierarchy built for scale
            </h2>
            <p className="mt-2 text-muted-foreground">
              Three tiers mapped to operational levels across the country.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PARTNER_TIERS.map((t, i) => (
              <Card key={t.name} className="relative border-border">
                <CardContent className="flex flex-col gap-3 p-6">
                  <Badge variant="outline" className="w-fit">
                    Tier {i + 1}
                  </Badge>
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <p className="flex items-center gap-1 text-sm font-medium text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    {t.level}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Registration form */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-16 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="text-balance text-3xl font-bold tracking-tight">
              Ready to onboard your school?
            </h2>
            <p className="text-muted-foreground">
              Tell us a little about your school. Your request is automatically
              routed to the right partner for your state and district.
            </p>
            <ul className="flex flex-col gap-3">
              {[
                'NEP-aligned onboarding support',
                'Dedicated regional partner',
                'Association-level coordination',
                'Transparent progress tracking',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Your details are secure and only shared with your assigned partner.
            </div>
          </div>
          <SchoolInterestForm
            onSubmit={handleSchoolSubmit}
            defaultState={attribution?.state}
            defaultDistrict={attribution?.district}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <School className="h-4 w-4" />
            <span>
              © {new Date().getFullYear()} {BRAND.company}. {BRAND.tagline}.
            </span>
          </div>
          <Link href="/login" className="hover:text-foreground" onClick={() => handleCta('footer_login')}>
            Partner login
          </Link>
        </div>
      </footer>
    </div>
  );
}
