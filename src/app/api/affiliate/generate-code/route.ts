import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function generateReferralCode(name: string): string {
  const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${cleanName.substr(0, 6)}-${random}`;
}

/**
 * POST /api/association/generate-code - Generate or regenerate referral code
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        affiliate: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'AFFILIATE') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Association role required.' },
        { status: 403 }
      );
    }

    let association = user.association;

    // If association record doesn't exist, create it
    if (!association) {
      const referralCode = generateReferralCode(user.name);
      
      association = await prisma.affiliate.create({
        data: {
          userId: user.id,
          referralCode,
          payoutDetails: {},
          balanceCents: 0
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Association profile created with referral code',
        association,
      });
    }

    // If association exists but no referral code, generate one
    if (!association.referralCode || association.referralCode.trim() === '') {
      const referralCode = generateReferralCode(user.name);
      
      association = await prisma.affiliate.update({
        where: { id: association.id },
        data: { referralCode }
      });

      return NextResponse.json({
        success: true,
        message: 'Referral code generated',
        association,
      });
    }

    // Association already has a referral code
    return NextResponse.json({
      success: true,
      message: 'Referral code already exists',
      association,
    });

  } catch (error) {
    console.error('Generate code API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate referral code' },
      { status: 500 }
    );
  }
}
