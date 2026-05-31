import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Calculate platform stats
    const totalAssociations = await prisma.affiliate.count();
    const totalUsers = await prisma.user.count();
    const totalReferrals = await prisma.referral.count();
    const totalConversions = await prisma.conversion.count();
    
    const pendingReferrals = await prisma.referral.count({
      where: { status: 'PENDING' }
    });
    
    const approvedReferrals = await prisma.referral.count({
      where: { status: 'APPROVED' }
    });
    
    // Calculate ACTUAL transaction revenue from conversions
    const totalRevenue = await prisma.conversion.aggregate({
      _sum: { amountCents: true }
    });
    
    // Calculate ESTIMATED revenue from referrals (leads)
    const referrals = await prisma.referral.findMany({
      include: {
        affiliate: true
      }
    });
    
    // Get all partner groups for incentive rate lookup
    const partnerGroups = await prisma.partnerGroup.findMany();
    const partnerGroupMap = new Map(
      partnerGroups.map(pg => [pg.id, pg.incentiveRate])
    );
    
    let totalEstimatedRevenue = 0;
    let totalEstimatedIncentive = 0;
    
    referrals.forEach((ref) => {
      const metadata = ref.metadata as any;
      const estimatedValue = Number(metadata?.estimated_value) || 0;
      const valueInCents = estimatedValue * 100;
      
      // Get incentive rate from partner group or default to 20%
      const association = ref.association as any;
      const partnerGroupId = association.partnerGroupId;
      const incentiveRate = partnerGroupId 
        ? (partnerGroupMap.get(partnerGroupId) || 0.20)
        : 0.20;
      const incentiveInCents = Math.floor(valueInCents * incentiveRate);
      
      totalEstimatedRevenue += valueInCents;
      totalEstimatedIncentive += incentiveInCents;
    });

    const stats = {
      totalAssociations,
      totalUsers,
      totalReferrals,
      totalConversions,
      pendingReferrals,
      approvedReferrals,
      totalRevenue: totalRevenue._sum?.amountCents || 0, // Actual transaction revenue
      totalEstimatedRevenue, // Estimated revenue from all leads
      totalEstimatedIncentive, // Total incentive to be paid
    };

    return NextResponse.json({ success: true, stats });

  } catch (error) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin data' },
      { status: 500 }
    );
  }
}