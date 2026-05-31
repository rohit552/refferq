import { NextRequest, NextResponse } from 'next/server';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';


// Update association status
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
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get association to find userId
    const association = await prisma.affiliate.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!association) {
      return NextResponse.json(
        { error: 'Association not found' },
        { status: 404 }
      );
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: association.userId },
      data: {
        status: status as UserStatus
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'UPDATE_ASSOCIATION_STATUS',
        objectType: 'ASSOCIATION',
        objectId: params.id,
        payload: {
          oldStatus: association.user.status,
          newStatus: status,
          notes: notes || null,
          associationEmail: association.user.email
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Association status updated to ${status}`,
      association: {
        id: association.id,
        userId: updatedUser.id,
        status: updatedUser.status
      }
    });

  } catch (error) {
    console.error('Update association status error:', error);
    return NextResponse.json(
      { error: 'Failed to update association status' },
      { status: 500 }
    );
  }
}

// Delete association
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

    // Get association to find userId
    const association = await prisma.affiliate.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!association) {
      return NextResponse.json(
        { error: 'Association not found' },
        { status: 404 }
      );
    }

    // Delete user (will cascade delete association due to Prisma schema)
    await prisma.user.delete({
      where: { id: association.userId }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'DELETE_ASSOCIATION',
        objectType: 'ASSOCIATION',
        objectId: params.id,
        payload: {
          associationName: association.user.name,
          associationEmail: association.user.email,
          referralCode: association.referralCode
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Association deleted successfully'
    });

  } catch (error) {
    console.error('Delete association error:', error);
    return NextResponse.json(
      { error: 'Failed to delete association' },
      { status: 500 }
    );
  }
}
