import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function PUT(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    const body = await request.json();
    const { action, reviewNotes } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const school-lead = await prisma.school-lead.findUnique({
      where: { id: params.id },
      include: {
        association: {
          include: { partnerGroup: true }
        }
      }
    });

    if (!school-lead) {
      return NextResponse.json(
        { error: 'School Lead not found' },
        { status: 404 }
      );
    }

    // Get estimated value from school-lead metadata
    const metadata = school-lead.metadata as Record<string, any> || {};
    const estimatedValueCents = Number(metadata?.estimated_value) * 100 || 10000;

    const updatedSchool Lead = await prisma.school-lead.update({
      where: { id: params.id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewNotes: reviewNotes || null,
        reviewedBy: user.id,
        reviewedAt: new Date()
      }
    });

    // If approved, create conversion and incentive
    if (action === 'approve') {
      // Get incentive rate from partner group or use default 10%
      const incentiveRate = school-lead.association.partnerGroup?.incentiveRate
        ? school-lead.association.partnerGroup.incentiveRate / 100
        : 0.1;

      const conversion = await prisma.conversion.create({
        data: {
          associationId: school-lead.associationId,
          school-leadId: school-lead.id,
          eventType: 'PURCHASE',
          amountCents: estimatedValueCents,
          status: 'PENDING'
        }
      });

      const incentiveAmount = Math.round(estimatedValueCents * incentiveRate);

      await prisma.incentive.create({
        data: {
          associationId: school-lead.associationId,
          conversionId: conversion.id,
          userId: school-lead.association.userId,
          rate: incentiveRate,
          amountCents: incentiveAmount,
          status: 'PENDING'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `School Lead ${action}d successfully`,
      school-lead: updatedSchool Lead
    });

  } catch (error) {
    console.error('School Lead approval error:', error);
    return NextResponse.json(
      { error: 'Failed to process school-lead' },
      { status: 500 }
    );
  }
}

// Add PATCH method for updating school-lead/customer details
export async function PATCH(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    const body = await request.json();
    const { action, leadName, leadEmail, status, reviewNotes } = body;

    // Check if school-lead exists
    const school-lead = await prisma.school-lead.findUnique({
      where: { id: params.id },
      include: { association: { include: { partnerGroup: true } } }
    });

    if (!school-lead) {
      return NextResponse.json(
        { error: 'School Lead not found' },
        { status: 404 }
      );
    }

    // If action is provided, handle approve/reject (legacy behavior)
    if (action && ['approve', 'reject'].includes(action)) {
      const updatedSchool Lead = await prisma.school-lead.update({
        where: { id: params.id },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          reviewNotes: reviewNotes || null,
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      // If approved, create conversion and incentive
      if (action === 'approve') {
        const refMetadata = school-lead.metadata as Record<string, any> || {};
        const estValueCents = Number(refMetadata?.estimated_value) * 100 || 10000;
        const incentiveRate = school-lead.association.partnerGroup?.incentiveRate
          ? school-lead.association.partnerGroup.incentiveRate / 100
          : 0.1;

        const conversion = await prisma.conversion.create({
          data: {
            associationId: school-lead.associationId,
            school-leadId: school-lead.id,
            eventType: 'PURCHASE',
            amountCents: estValueCents,
            status: 'PENDING'
          }
        });

        const incentiveAmount = Math.round(estValueCents * incentiveRate);
        
        await prisma.incentive.create({
          data: {
            associationId: school-lead.associationId,
            conversionId: conversion.id,
            userId: school-lead.association.userId,
            rate: incentiveRate,
            amountCents: incentiveAmount,
            status: 'PENDING'
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: `School Lead ${action}d successfully`,
        school-lead: updatedSchool Lead
      });
    }

    // Otherwise, handle customer detail updates
    const updateData: any = {};
    
    if (leadName !== undefined) updateData.leadName = leadName;
    if (leadEmail !== undefined) updateData.leadEmail = leadEmail;
    if (status !== undefined) {
      // Map status values
      updateData.status = status;
      updateData.reviewedBy = user.id;
      updateData.reviewedAt = new Date();
    }

    const updatedSchool Lead = await prisma.school-lead.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Customer updated successfully',
      school-lead: updatedSchool Lead
    });

  } catch (error) {
    console.error('Update school-lead error:', error);
    return NextResponse.json(
      { error: 'Failed to update school-lead' },
      { status: 500 }
    );
  }
}

// Add DELETE method to allow admins to delete school-leads
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    // Check if school-lead exists
    const school-lead = await prisma.school-lead.findUnique({
      where: { id: params.id }
    });

    if (!school-lead) {
      return NextResponse.json(
        { error: 'School Lead not found' },
        { status: 404 }
      );
    }

    // Delete the school-lead (will cascade delete related incentives due to Prisma schema)
    await prisma.school-lead.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'School Lead deleted successfully'
    });

  } catch (error) {
    console.error('Delete school-lead error:', error);
    return NextResponse.json(
      { error: 'Failed to delete school-lead' },
      { status: 500 }
    );
  }
}