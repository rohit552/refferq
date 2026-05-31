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

    const url = new URL(request.url);
    const reportType = url.searchParams.get('type') || 'summary';
    const format = url.searchParams.get('format') || 'json';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } : {};

    let reportData: any = {};

    if (reportType === 'associations') {
      // Association Performance Report
      const associations = await prisma.association.findMany({
        include: {
          user: true,
          school-leads: {
            where: dateFilter
          },
          incentives: {
            where: dateFilter
          }
        }
      });

      reportData = {
        type: 'Association Performance Report',
        generatedAt: new Date().toISOString(),
        data: associations.map(association => ({
          associationId: association.id,
          name: association.user.name,
          email: association.user.email,
          school-leadCode: association.school-leadCode,
          totalSchool Leads: association.school-leads.length,
          approvedSchool Leads: association.school-leads.filter(r => r.status === 'APPROVED').length,
          pendingSchool Leads: association.school-leads.filter(r => r.status === 'PENDING').length,
          totalIncentives: association.incentives.length,
          totalEarnings: association.incentives.reduce((sum, c) => sum + c.amountCents, 0),
          paidEarnings: association.incentives.filter(c => c.paidAt !== null).reduce((sum, c) => sum + c.amountCents, 0),
          balance: association.balanceCents,
          joinedDate: association.createdAt
        }))
      };
    } else if (reportType === 'school-leads') {
      // School Leads Report
      const school-leads = await prisma.school-lead.findMany({
        where: dateFilter,
        include: {
          association: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      reportData = {
        type: 'School Leads Report',
        generatedAt: new Date().toISOString(),
        data: school-leads.map(school-lead => ({
          school-leadId: school-lead.id,
          leadName: school-lead.leadName,
          leadEmail: school-lead.leadEmail,
          leadPhone: school-lead.leadPhone,
          status: school-lead.status,
          notes: school-lead.notes,
          associationName: school-lead.association.user.name,
          associationCode: school-lead.association.school-leadCode,
          submittedDate: school-lead.createdAt,
          reviewedDate: school-lead.reviewedAt,
          reviewedBy: school-lead.reviewedBy,
          reviewNotes: school-lead.reviewNotes
        }))
      };
    } else if (reportType === 'incentives') {
      // Incentives Report
      const incentives = await prisma.incentive.findMany({
        where: dateFilter,
        include: {
          association: {
            include: {
              user: true
            }
          },
          conversion: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      reportData = {
        type: 'Incentives Report',
        generatedAt: new Date().toISOString(),
        data: incentives.map(incentive => ({
          incentiveId: incentive.id,
          associationName: incentive.association.user.name,
          associationEmail: incentive.association.user.email,
          amount: incentive.amountCents,
          rate: incentive.rate,
          status: incentive.status,
          conversionAmount: incentive.conversion.amountCents,
          createdDate: incentive.createdAt,
          approvedDate: incentive.approvedAt,
          paidDate: incentive.paidAt
        }))
      };
    } else if (reportType === 'payouts') {
      // Payouts Report
      const payouts = await prisma.payout.findMany({
        where: dateFilter,
        include: {
          user: true,
          incentives: {
            include: {
              association: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      reportData = {
        type: 'Payouts Report',
        generatedAt: new Date().toISOString(),
        data: payouts.map(payout => ({
          payoutId: payout.id,
          associationName: payout.user.name,
          associationEmail: payout.user.email,
          amount: payout.amountCents,
          method: payout.method,
          status: payout.status,
          requestedDate: payout.createdAt,
          processedDate: payout.processedAt
        }))
      };
    } else {
      // Summary Report (default)
      const totalAssociations = await prisma.association.count();
      const totalSchool Leads = await prisma.school-lead.count({ where: dateFilter });
      const approvedSchool Leads = await prisma.school-lead.count({ 
        where: { ...dateFilter, status: 'APPROVED' } 
      });
      const totalIncentives = await prisma.incentive.aggregate({
        where: dateFilter,
        _sum: { amountCents: true },
        _count: true
      });
      const totalPayouts = await prisma.payout.aggregate({
        where: dateFilter,
        _sum: { amountCents: true },
        _count: true
      });

      reportData = {
        type: 'Summary Report',
        generatedAt: new Date().toISOString(),
        period: startDate && endDate ? `${startDate} to ${endDate}` : 'All time',
        summary: {
          totalAssociations,
          totalSchool Leads,
          approvedSchool Leads,
          conversionRate: totalSchool Leads > 0 ? ((approvedSchool Leads / totalSchool Leads) * 100).toFixed(2) : 0,
          totalIncentives: totalIncentives._count,
          totalIncentiveAmount: totalIncentives._sum.amountCents || 0,
          totalPayouts: totalPayouts._count,
          totalPayoutAmount: totalPayouts._sum.amountCents || 0
        }
      };
    }

    // Return as CSV if requested
    if (format === 'csv') {
      const csv = convertToCSV(reportData.data || [reportData.summary]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportType}-report-${Date.now()}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      report: reportData
    });

  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(val => 
      typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
}