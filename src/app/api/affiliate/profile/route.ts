import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    // Get user from database to ensure they still exist and get latest data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        association: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'ASSOCIATION') {
      return NextResponse.json(
        { error: 'Access denied. Association role required.' },
        { status: 403 }
      );
    }

    const association = user.association as any;
    if (!association) {
      return NextResponse.json(
        { error: 'Association profile not found' },
        { status: 404 }
      );
    }

    // Get association statistics
    const referrals = await prisma.referral.findMany({
      where: { associationId: association.id },
      orderBy: { createdAt: 'desc' }
    });

    const conversions = await prisma.conversion.findMany({
      where: { associationId: association.id },
      orderBy: { createdAt: 'desc' }
    });

    const incentives = await prisma.incentive.findMany({
      where: { associationId: association.id },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate stats
    // Available earnings = COMPLETED (PAID) + APPROVED but not yet paid
    const availableEarnings = incentives
      .filter(c => c.status === 'PAID' || c.status === 'APPROVED')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const pendingIncentivesList = incentives.filter(c => c.status === 'PENDING');
    const pendingEarningsCents = pendingIncentivesList.reduce((sum, c) => sum + c.amountCents, 0);

    const totalIncentives = incentives.length;
    const pendingIncentivesCount = pendingIncentivesList.length;
    const totalConversions = conversions.length;
    const totalClicks = referrals.reduce((sum, r) => {
      const metadata = r.metadata as any;
      return sum + (metadata?.clicks || 0);
    }, 0);
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    // Next maturation date for pending incentives
    const nextMaturesAt = pendingIncentivesList
      .filter(c => (c as any).maturesAt)
      .sort((a, b) => ((a as any).maturesAt.getTime() - (b as any).maturesAt.getTime()))[0]?.maturesAt || null;

    const stats = {
      totalEarnings: availableEarnings,
      pendingEarnings: pendingEarningsCents,
      pendingEarningsList: pendingIncentivesList.length,
      nextMaturesAt,
      totalIncentives,
      pendingIncentives: pendingIncentivesCount,
      totalConversions,
      totalClicks,
      conversionRate
    };

    // Map referrals to include estimatedValue from metadata
    const mappedReferrals = referrals.map(ref => {
      const metadata = ref.metadata as any;
      return {
        ...ref,
        estimatedValue: Number(metadata?.estimated_value) || 0,
        company: metadata?.company || '',
      };
    });

    // Get currency symbol
    const { getCurrencySymbol } = await import('@/lib/currency');
    const currencySymbol = await getCurrencySymbol();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      association: association,
      stats,
      referrals: mappedReferrals,
      conversions,
      incentives,
      currencySymbol,
    });
  } catch (error) {
    console.error('Association profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch association profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        association: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'ASSOCIATION') {
      return NextResponse.json(
        { error: 'Access denied. Association role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, company, email, country, paymentMethod, paymentEmail } = body;

    // Update user name and email if provided
    const userUpdateData: any = {};
    if (name && name.trim()) {
      userUpdateData.name = name.trim();
    }
    if (email && email.trim() && email !== user.email) {
      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() }
      });
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
      userUpdateData.email = email.trim().toLowerCase();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData
      });
    }

    // Update association payout details if provided
    if (user.association) {
      const payoutDetails: any = {};

      if (company) payoutDetails.company = company.trim();
      if (country) payoutDetails.country = country;
      if (paymentMethod) payoutDetails.paymentMethod = paymentMethod;
      if (paymentEmail) payoutDetails.paymentEmail = paymentEmail.trim();

      await prisma.affiliate.update({
        where: { id: user.association.id },
        data: {
          payoutDetails: payoutDetails
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Association profile update API error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}