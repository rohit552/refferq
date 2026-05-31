import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function generateSchool LeadCode(name: string): string {
  const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${cleanName.substr(0, 6)}-${random}`;
}

/**
 * POST /api/association/generate-code - Generate or regenerate school-lead code
 */
export async function POST(request: NextRequest) {
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
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'ASSOCIATION') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Association role required.' },
        { status: 403 }
      );
    }

    let association = user.association;

    // If association record doesn't exist, create it
    if (!association) {
      const school-leadCode = generateSchool LeadCode(user.name);
      
      association = await prisma.association.create({
        data: {
          userId: user.id,
          school-leadCode,
          payoutDetails: {},
          balanceCents: 0
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Association profile created with school-lead code',
        association,
      });
    }

    // If association exists but no school-lead code, generate one
    if (!association.school-leadCode || association.school-leadCode.trim() === '') {
      const school-leadCode = generateSchool LeadCode(user.name);
      
      association = await prisma.association.update({
        where: { id: association.id },
        data: { school-leadCode }
      });

      return NextResponse.json({
        success: true,
        message: 'School Lead code generated',
        association,
      });
    }

    // Association already has a school-lead code
    return NextResponse.json({
      success: true,
      message: 'School Lead code already exists',
      association,
    });

  } catch (error) {
    console.error('Generate code API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate school-lead code' },
      { status: 500 }
    );
  }
}
