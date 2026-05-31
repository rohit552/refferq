'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Users,
  Crown,
  Layers,
  UserCheck,
  School,
  TrendingUp,
  Eye,
  MousePointerClick,
  MapPin,
} from 'lucide-react';

interface NepData {
  summary: {
    totalPartners: number;
    masterPartners: number;
    subPartners: number;
    partners: number;
    totalSchoolLeads: number;
    conversions: number;
    pageViews: number;
    uniqueVisits: number;
    ctaClicks: number;
  };
  tiers: { tier: string; label: string; level: string; count: number }[];
  visitsByState: { name: string; count: number }[];
  conversionsByState: { name: string; count: number }[];
  conversionsByDistrict: { name: string; count: number }[];
  partnerPerformance: { name: string; code: string; leads: number; tier: string }[];
  recentActivity: {
    id: string;
    leadName: string;
    school: string | null;
    state: string | null;
    district: string | null;
    partner: string;
    status: string;
    createdAt: string;
  }[];
}

const TIER_LABEL: Record<string, string> = {
  MASTER: 'Master Partner',
  SUB: 'Sub Partner',
  PARTNER: 'Partner',
};

export default function AdminNepPage() {
  const [data, setData] = useState<NepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/nep');
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        if (mounted) setData(json);
      } catch (_e) {
        if (mounted) setError('Could not load NEP analytics.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error || 'No data available.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data.summary;

  const statCards = [
    { label: 'Total Partners', value: s.totalPartners, icon: Users },
    { label: 'Master Partners', value: s.masterPartners, icon: Crown },
    { label: 'Sub Partners', value: s.subPartners, icon: Layers },
    { label: 'Partners', value: s.partners, icon: UserCheck },
    { label: 'School Leads (/nep)', value: s.totalSchoolLeads, icon: School },
    { label: 'Conversions', value: s.conversions, icon: TrendingUp },
    { label: 'Page Views', value: s.pageViews, icon: Eye },
    { label: 'CTA Clicks', value: s.ctaClicks, icon: MousePointerClick },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">NEP Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Partner hierarchy, school onboarding, and /nep landing performance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-2xl font-bold">{c.value.toLocaleString()}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hierarchy + Conversions by state */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Partner Hierarchy</CardTitle>
            <CardDescription>Master / Sub / Partner by operational level</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.tiers.map((t) => (
              <div
                key={t.tier}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{t.label}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {t.level}
                  </span>
                </div>
                <span className="text-xl font-bold">{t.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversions by State</CardTitle>
            <CardDescription>School onboarding leads per state</CardDescription>
          </CardHeader>
          <CardContent>
            {data.conversionsByState.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No state-level data yet.
              </p>
            ) : (
              <ChartContainer
                config={{ count: { label: 'Leads', color: 'hsl(var(--chart-1))' } }}
                className="h-[240px] w-full"
              >
                <BarChart data={data.conversionsByState.slice(0, 8)} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visits by state + Conversions by district */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visits by State</CardTitle>
            <CardDescription>/nep landing visits attributed by state</CardDescription>
          </CardHeader>
          <CardContent>
            {data.visitsByState.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No visit data yet.
              </p>
            ) : (
              <ChartContainer
                config={{ count: { label: 'Visits', color: 'hsl(var(--chart-2))' } }}
                className="h-[240px] w-full"
              >
                <BarChart data={data.visitsByState.slice(0, 8)}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversions by District</CardTitle>
            <CardDescription>Top districts by school leads</CardDescription>
          </CardHeader>
          <CardContent>
            {data.conversionsByDistrict.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No district-level data yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.conversionsByDistrict.slice(0, 8).map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span>{d.name}</span>
                    <Badge variant="secondary">{d.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partner performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Partner Performance</CardTitle>
          <CardDescription>Top partners by school leads generated</CardDescription>
        </CardHeader>
        <CardContent>
          {data.partnerPerformance.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No partners yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.partnerPerformance.map((p) => (
                  <TableRow key={p.code}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{TIER_LABEL[p.tier] || p.tier}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{p.leads}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Latest school onboarding leads from /nep</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead / School</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentActivity.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.school || a.leadName}</div>
                      {a.school && (
                        <div className="text-xs text-muted-foreground">{a.leadName}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {[a.district, a.state].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-sm">{a.partner}</TableCell>
                    <TableCell>
                      <Badge
                        variant={a.status === 'APPROVED' ? 'default' : 'secondary'}
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
