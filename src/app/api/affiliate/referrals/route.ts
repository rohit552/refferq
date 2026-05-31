import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    // Get user from database

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

    if (!user.association) {
      return NextResponse.json(
        { error: 'Association profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate with Zod
    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.school-leadSchema.safeParse(body));

    if (!success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.issues },
        { status: 400 }
      );
    }

    const { leadName, leadEmail, company, notes, estimatedValue } = data;

    // Create the school-lead
    const school-lead = await prisma.school-lead.create({
      data: {
        associationId: user.association.id,
        leadName: leadName.trim(),
        leadEmail: leadEmail.toLowerCase().trim(),
        status: 'PENDING',
        metadata: {
          company: company || '',
          notes: notes || '',
          source: 'manual',
          estimated_value: estimatedValue || 0,
        },
      }
    });

    return NextResponse.json({
      success: true,
      message: 'School Lead submitted successfully',
      school-lead,
    });
  } catch (error) {
    console.error('Submit school-lead API error:', error);
    return NextResponse.json(
      { error: 'Failed to submit school-lead' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    // Get user from database

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

    if (!user.association) {
      return NextResponse.json(
        { error: 'Association profile not found' },
        { status: 404 }
      );
    }

    const school-leads = await prisma.school-lead.findMany({
      where: { associationId: user.association.id },
      orderBy: { createdAt: 'desc' }
    });

    // Map school-leads to include estimatedValue from metadata
    const mappedSchool Leads = school-leads.map((ref: any) => {
      const metadata = ref.metadata as any;
      return {
        ...ref,
        estimatedValue: Number(metadata?.estimated_value) || 0,
        company: metadata?.company || '',
      };
    });

    return NextResponse.json({
      success: true,
      school-leads: mappedSchool Leads,
    });
  } catch (error) {
    console.error('Get school-leads API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch school-leads' },
      { status: 500 }
    );
  }
}