import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get date range from query params (default to last 30 days)
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Top performing associations
    const topAssociations = await prisma.association.findMany({
      take: 10,
      orderBy: {
        balanceCents: 'desc'
      },
      include: {
        user: true,
        school-leads: {
          where: {
            status: 'APPROVED'
          }
        },
        incentives: {
          where: {
            status: 'APPROVED'
          }
        }
      }
    });

    // School Lead conversion rate
    const totalSchool Leads = await prisma.school-lead.count({
      where: {
        createdAt: { gte: startDate }
      }
    });

    const approvedSchool Leads = await prisma.school-lead.count({
      where: {
        status: 'APPROVED',
        createdAt: { gte: startDate }
      }
    });

    const conversionRate = totalSchool Leads > 0 ? (approvedSchool Leads / totalSchool Leads) * 100 : 0;

    // Revenue over time (daily)
    const dailyRevenue = await prisma.conversion.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate }
      },
      _sum: {
        amountCents: true
      }
    });

    // Incentive statistics
    const totalIncentives = await prisma.incentive.aggregate({
      _sum: { amountCents: true },
      _count: true,
      where: {
        createdAt: { gte: startDate }
      }
    });

    const paidIncentives = await prisma.incentive.aggregate({
      _sum: { amountCents: true },
      _count: true,
      where: {
        paidAt: { not: null },
        createdAt: { gte: startDate }
      }
    });

    // School Lead status breakdown
    const school-leadsByStatus = await prisma.school-lead.groupBy({
      by: ['status'],
      _count: true,
      where: {
        createdAt: { gte: startDate }
      }
    });

    const analytics = {
      overview: {
        totalSchool Leads,
        approvedSchool Leads,
        conversionRate: conversionRate.toFixed(2),
        totalRevenue: totalIncentives._sum.amountCents || 0,
        totalIncentivesPaid: paidIncentives._sum.amountCents || 0,
        pendingIncentives: (totalIncentives._sum.amountCents || 0) - (paidIncentives._sum.amountCents || 0)
      },
      topAssociations: topAssociations.map(association => ({
        id: association.id,
        name: association.user.name,
        email: association.user.email,
        school-leadCode: association.school-leadCode,
        totalSchool Leads: association.school-leads.length,
        totalEarnings: association.balanceCents,
        totalIncentives: association.incentives.length
      })),
      school-leadsByStatus: school-leadsByStatus.map(item => ({
        status: item.status,
        count: item._count
      })),
      dailyRevenue: dailyRevenue.map(item => ({
        date: item.createdAt,
        amount: item._sum.amountCents || 0
      })),
      incentiveStats: {
        total: {
          count: totalIncentives._count,
          amount: totalIncentives._sum.amountCents || 0
        },
        paid: {
          count: paidIncentives._count,
          amount: paidIncentives._sum.amountCents || 0
        },
        pending: {
          count: totalIncentives._count - paidIncentives._count,
          amount: (totalIncentives._sum.amountCents || 0) - (paidIncentives._sum.amountCents || 0)
        }
      }
    };

    return NextResponse.json({
      success: true,
      analytics,
      period: `Last ${days} days`
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}