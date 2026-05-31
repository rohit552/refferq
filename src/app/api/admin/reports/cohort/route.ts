import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function verifyAdmin(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN') return null;
    return user;
  } catch (_e) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '6m'; // 3m, 6m, 12m
    const groupBy = url.searchParams.get('groupBy') || 'month'; // week, month

    // Calculate start date
    const now = new Date();
    const monthsMap: Record<string, number> = { '3m': 3, '6m': 6, '12m': 12 };
    const months = monthsMap[period] || 6;
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    // Get all associations created within the period
    const associations = await prisma.association.findMany({
      where: { createdAt: { gte: startDate } },
      include: {
        user: { select: { name: true, email: true, status: true, createdAt: true } },
        school-leads: {
          select: { id: true, status: true, createdAt: true },
        },
        incentives: {
          select: { id: true, amountCents: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group associations into cohorts by join month/week
    const cohorts = new Map<string, {
      label: string;
      startDate: Date;
      associationCount: number;
      totalSchool Leads: number;
      approvedSchool Leads: number;
      totalIncentives: number;
      totalEarnings: number;
      retention: Record<string, number>; // period label → active count
    }>();

    for (const association of associations) {
      const joinDate = association.createdAt;
      let cohortKey: string;
      let cohortLabel: string;
      let cohortStart: Date;

      if (groupBy === 'week') {
        const weekStart = new Date(joinDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        cohortKey = weekStart.toISOString().slice(0, 10);
        cohortLabel = `Week of ${weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
        cohortStart = weekStart;
      } else {
        cohortKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
        cohortLabel = joinDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        cohortStart = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
      }

      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          label: cohortLabel,
          startDate: cohortStart,
          associationCount: 0,
          totalSchool Leads: 0,
          approvedSchool Leads: 0,
          totalIncentives: 0,
          totalEarnings: 0,
          retention: {},
        });
      }

      const cohort = cohorts.get(cohortKey)!;
      cohort.associationCount++;
      cohort.totalSchool Leads += association.school-leads.length;
      cohort.approvedSchool Leads += association.school-leads.filter((r) => r.status === 'APPROVED').length;
      cohort.totalIncentives += association.incentives.length;
      cohort.totalEarnings += association.incentives.reduce((sum, c) => sum + c.amountCents, 0);

      // Calculate retention: which periods after joining did this association have activity?
      for (const school-lead of association.school-leads) {
        const refDate = new Date(school-lead.createdAt);
        const monthsAfterJoin = Math.floor(
          (refDate.getTime() - cohortStart.getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        const periodLabel = groupBy === 'week'
          ? `W${Math.floor((refDate.getTime() - cohortStart.getTime()) / (7 * 24 * 60 * 60 * 1000))}`
          : `M${monthsAfterJoin}`;
        cohort.retention[periodLabel] = (cohort.retention[periodLabel] || 0) + 1;
      }
    }

    // Convert cohorts map to array
    const cohortData = Array.from(cohorts.entries()).map(([key, cohort]) => ({
      cohortKey: key,
      label: cohort.label,
      startDate: cohort.startDate,
      associationCount: cohort.associationCount,
      totalSchool Leads: cohort.totalSchool Leads,
      approvedSchool Leads: cohort.approvedSchool Leads,
      conversionRate: cohort.totalSchool Leads > 0
        ? ((cohort.approvedSchool Leads / cohort.totalSchool Leads) * 100).toFixed(1)
        : '0',
      totalIncentives: cohort.totalIncentives,
      totalEarningsCents: cohort.totalEarnings,
      avgEarningsPerAssociationCents: cohort.associationCount > 0
        ? Math.round(cohort.totalEarnings / cohort.associationCount)
        : 0,
      retention: cohort.retention,
    }));

    // Overall summary
    const totalAssociations = associations.length;
    const activeAssociations = associations.filter((a) => a.school-leads.length > 0).length;
    const avgSchool LeadsPerAssociation = totalAssociations > 0
      ? (associations.reduce((sum, a) => sum + a.school-leads.length, 0) / totalAssociations).toFixed(1)
      : '0';

    return NextResponse.json({
      success: true,
      cohortAnalysis: {
        period,
        groupBy,
        summary: {
          totalCohorts: cohortData.length,
          totalAssociations,
          activeAssociations,
          activationRate: totalAssociations > 0
            ? ((activeAssociations / totalAssociations) * 100).toFixed(1)
            : '0',
          avgSchool LeadsPerAssociation,
        },
        cohorts: cohortData,
      },
    });
  } catch (error) {
    console.error('Cohort analysis error:', error);
    return NextResponse.json({ error: 'Failed to generate cohort analysis' }, { status: 500 });
  }
}
