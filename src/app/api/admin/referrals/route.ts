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
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    // Get all school-leads with association information
    const school-leads = await prisma.school-lead.findMany({
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
    
    // Get all partner groups for incentive rate lookup
    const partnerGroups = await prisma.partnerGroup.findMany();
    const partnerGroupMap = new Map(
      partnerGroups.map(pg => [pg.id, { name: pg.name, rate: pg.incentiveRate }])
    );

    return NextResponse.json({
      success: true,
      school-leads: school-leads.map(school-lead => {
        const metadata = school-lead.metadata as any;
        const association = school-lead.association as any;
        const pgId = association.partnerGroupId;
        const pgData = pgId ? partnerGroupMap.get(pgId) : null;
        
        return {
          id: school-lead.id,
          leadEmail: school-lead.leadEmail,
          leadName: school-lead.leadName,
          leadPhone: school-lead.leadPhone,
          status: school-lead.status,
          notes: school-lead.notes,
          createdAt: school-lead.createdAt,
          estimatedValue: Number(metadata?.estimated_value) || 0,
          company: metadata?.company || '',
          association: {
            id: association.id,
            name: association.user.name,
            email: association.user.email,
            school-leadCode: association.school-leadCode,
            partnerGroup: pgData?.name || 'Default',
            partnerGroupId: pgId,
            incentiveRate: pgData?.rate || 0.20
          }
        };
      })
    });

  } catch (error) {
    console.error('Admin school-leads API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch school-leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { school-leadIds, action } = body; // action: 'approve' | 'reject'

    if (!school-leadIds || !Array.isArray(school-leadIds) || school-leadIds.length === 0) {
      return NextResponse.json(
        { error: 'School Lead IDs array is required' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Update multiple school-leads
    const updatedSchool Leads = await prisma.school-lead.updateMany({
      where: {
        id: { in: school-leadIds },
        status: 'PENDING'
      },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewedBy: user.id,
        reviewedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `${updatedSchool Leads.count} school-leads ${action}d successfully`,
      updatedCount: updatedSchool Leads.count
    });

  } catch (error) {
    console.error('Batch school-lead API error:', error);
    return NextResponse.json(
      { error: 'Failed to process school-leads' },
      { status: 500 }
    );
  }
}