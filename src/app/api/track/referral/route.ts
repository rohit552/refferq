import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/track/school-lead - Track school-lead clicks
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      );
    }

    // Verify API key
    const integration = await prisma.integrationSettings.findFirst({
      where: {
        publicKey: apiKey,
        isActive: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive API key' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { school-leadCode, url, referrer, userAgent, timestamp } = body;

    if (!school-leadCode) {
      return NextResponse.json(
        { success: false, error: 'School Lead code is required' },
        { status: 400 }
      );
    }

    // Find association by school-lead code
    const association = await prisma.association.findUnique({
      where: { school-leadCode },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!association) {
      return NextResponse.json(
        { success: false, error: 'Invalid school-lead code' },
        { status: 404 }
      );
    }

    if (association.user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Association is not active' },
        { status: 403 }
      );
    }

    // Log the school-lead click
    console.log('✅ School Lead click tracked:', {
      associationId: association.id,
      school-leadCode,
      url,
      referrer,
      timestamp,
    });

    // You can optionally create a School LeadClick record or update stats
    // For now, we'll just log it and return success

    return NextResponse.json({
      success: true,
      message: 'School Lead tracked successfully',
      association: {
        name: association.user.name,
        code: association.school-leadCode,
      },
    });
  } catch (error) {
    console.error('POST /api/track/school-lead error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track school-lead' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
}
