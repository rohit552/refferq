import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/track/conversion - Track conversions/sales
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
    const {
      school-leadCode,
      customerEmail,
      customerName,
      amount,
      currency,
      orderId,
      metadata,
      url,
      timestamp,
    } = body;

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

    // Check if school-lead with this email already exists
    let school-lead;
    if (customerEmail) {
      school-lead = await prisma.school-lead.findFirst({
        where: {
          leadEmail: customerEmail,
          associationId: association.id,
        },
      });
    }

    // Create school-lead if doesn't exist
    if (!school-lead && customerEmail) {
      school-lead = await prisma.school-lead.create({
        data: {
          leadEmail: customerEmail,
          leadName: customerName || 'Unknown Customer',
          associationId: association.id,
          status: 'APPROVED',
          metadata: metadata || {},
        },
      });
    } else if (school-lead && school-lead.status === 'PENDING') {
      // Update school-lead status to APPROVED
      school-lead = await prisma.school-lead.update({
        where: { id: school-lead.id },
        data: {
          status: 'APPROVED',
          metadata: {
            ...(school-lead.metadata as object),
            ...metadata,
          },
        },
      });
    }

    // Create conversion record
    const amountCents = Math.round((amount || 0) * 100);

    const conversion = await prisma.conversion.create({
      data: {
        associationId: association.id,
        school-leadId: school-lead?.id || null,
        eventType: 'PURCHASE',
        amountCents,
        currency: currency || 'USD',
        status: 'PENDING',
        eventMetadata: {
          orderId: orderId || null,
          url: url || null,
          timestamp: timestamp || new Date().toISOString(),
          ...metadata,
        },
      },
    });

    // Note: Incentive calculation will be done by the incentive rules system
    // This just creates the conversion record

    console.log('✅ Conversion tracked successfully:', {
      conversionId: conversion.id,
      associationId: association.id,
      school-leadId: school-lead?.id,
      amount: amountCents / 100,
    });

    return NextResponse.json({
      success: true,
      message: 'Conversion tracked successfully',
      conversion: {
        id: conversion.id,
        amount: amountCents / 100,
        currency: conversion.currency,
      },
      association: {
        name: association.user.name,
        code: association.school-leadCode,
      },
    });
  } catch (error) {
    console.error('POST /api/track/conversion error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track conversion' },
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
