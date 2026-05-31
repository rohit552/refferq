import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tierFromGroupName, PARTNER_TIERS, type PartnerTier } from '@/lib/partner-hierarchy';

/**
 * GET /api/admin/nep
 *
 * Aggregates SkillHeed NEP analytics from the existing data model
 * (Association, PartnerGroup, School Lead, School LeadClick) — no schema changes.
 * Admin-only (enforced by middleware + the role check below).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ── Partner hierarchy counts ──────────────────────────────
    const associations = await prisma.association.findMany({
      include: { partnerGroup: true, user: { select: { name: true, email: true } } },
    });

    const tierCounts: Record<PartnerTier, number> = { MASTER: 0, SUB: 0, PARTNER: 0 };
    for (const a of associations) {
      tierCounts[tierFromGroupName(a.partnerGroup?.name)]++;
    }

    // ── NEP landing events (stored as School LeadClick with channel '/nep') ──
    const nepClicks = await prisma.school-leadClick.findMany({
      where: { metadata: { path: ['channel'], equals: '/nep' } },
      select: { metadata: true, createdAt: true, school-lead: { select: { associationId: true } } },
    });

    let pageViews = 0;
    let uniqueVisits = 0;
    let ctaClicks = 0;
    const byState: Record<string, number> = {};
    const byDistrict: Record<string, number> = {};

    for (const c of nepClicks) {
      const m = (c.metadata || {}) as Record<string, unknown>;
      const ev = String(m.event_type || '');
      if (ev === 'page_view') pageViews++;
      else if (ev === 'unique_visit') uniqueVisits++;
      else if (ev === 'cta_click') ctaClicks++;
      const state = m.state ? String(m.state) : null;
      const district = m.district ? String(m.district) : null;
      if (state) byState[state] = (byState[state] || 0) + 1;
      if (district) byDistrict[district] = (byDistrict[district] || 0) + 1;
    }

    // ── NEP leads / school onboarding (School Lead with source 'nep_landing') ──
    const nepLeads = await prisma.school-lead.findMany({
      where: { metadata: { path: ['source'], equals: 'nep_landing' } },
      include: { association: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const schoolLeads = nepLeads.filter((r) => {
      const m = (r.metadata || {}) as Record<string, unknown>;
      return m.event_type === 'school_interest' || m.school_name;
    });

    const conversions = schoolLeads.filter((r) => r.status === 'APPROVED');

    // Conversions by state / district from lead metadata
    const convByState: Record<string, number> = {};
    const convByDistrict: Record<string, number> = {};
    for (const l of schoolLeads) {
      const m = (l.metadata || {}) as Record<string, unknown>;
      const s = m.state ? String(m.state) : null;
      const d = m.district ? String(m.district) : null;
      if (s) convByState[s] = (convByState[s] || 0) + 1;
      if (d) convByDistrict[d] = (convByDistrict[d] || 0) + 1;
    }

    // Partner performance (leads per partner)
    const perfMap: Record<string, { name: string; code: string; leads: number; tier: PartnerTier }> = {};
    for (const a of associations) {
      perfMap[a.id] = {
        name: a.user.name,
        code: a.school-leadCode,
        leads: 0,
        tier: tierFromGroupName(a.partnerGroup?.name),
      };
    }
    for (const l of schoolLeads) {
      if (perfMap[l.associationId]) perfMap[l.associationId].leads++;
    }
    const partnerPerformance = Object.values(perfMap)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);

    // Recent activity (latest NEP leads)
    const recentActivity = nepLeads.slice(0, 10).map((r) => {
      const m = (r.metadata || {}) as Record<string, unknown>;
      return {
        id: r.id,
        leadName: r.leadName,
        school: m.school_name ? String(m.school_name) : null,
        state: m.state ? String(m.state) : null,
        district: m.district ? String(m.district) : null,
        partner: r.association.user.name,
        status: r.status,
        createdAt: r.createdAt,
      };
    });

    const toSorted = (rec: Record<string, number>) =>
      Object.entries(rec)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      summary: {
        totalPartners: associations.length,
        masterPartners: tierCounts.MASTER,
        subPartners: tierCounts.SUB,
        partners: tierCounts.PARTNER,
        totalSchoolLeads: schoolLeads.length,
        conversions: conversions.length,
        pageViews,
        uniqueVisits,
        ctaClicks,
      },
      tiers: (Object.keys(PARTNER_TIERS) as PartnerTier[]).map((t) => ({
        tier: t,
        label: PARTNER_TIERS[t].label,
        level: PARTNER_TIERS[t].levelLabel,
        count: tierCounts[t],
      })),
      visitsByState: toSorted(byState),
      visitsByDistrict: toSorted(byDistrict),
      conversionsByState: toSorted(convByState),
      conversionsByDistrict: toSorted(convByDistrict),
      partnerPerformance,
      recentActivity,
    });
  } catch (error) {
    console.error('GET /api/admin/nep error:', error);
    return NextResponse.json({ error: 'Failed to load NEP analytics' }, { status: 500 });
  }
}
