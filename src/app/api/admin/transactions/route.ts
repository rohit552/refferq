import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// GET - Fetch all transactions (Admin only)
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const referralId = searchParams.get('referralId');
    const associationId = searchParams.get('associationId');

    // Build where clause
    const where: any = {};
    if (referralId) where.referralId = referralId;
    if (associationId) where.associationId = associationId;

    const transactions = await (prisma as any).transaction.findMany({
      where,
      include: {
        referral: true,
        affiliate: {
          include: {
            user: true,
            partnerGroup: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      transactions: transactions.map((txn: any) => {
        const association = txn.association as any;
        return {
          id: txn.id,
          customerId: txn.customerId,
          customerName: txn.customerName,
          customerEmail: txn.customerEmail,
          amountCents: txn.amountCents,
          incentiveCents: txn.incentiveCents,
          incentiveRate: txn.incentiveRate,
          status: txn.status,
          description: txn.description,
          invoiceId: txn.invoiceId,
          paymentMethod: txn.paymentMethod,
          paidAt: txn.paidAt,
          createdAt: txn.createdAt,
          referral: {
            id: txn.referral.id,
            leadName: txn.referral.leadName,
            leadEmail: txn.referral.leadEmail,
            status: txn.referral.status
          },
          affiliate: {
            id: association.id,
            name: association.user.name,
            email: association.user.email,
            referralCode: association.referralCode,
            partnerGroup: association.partnerGroupId ? 
              (association.partnerGroup?.name || 'Default') : 
              'Default'
          }
        };
      })
    });

  } catch (error) {
    console.error('Get transactions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST - Create new transaction
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
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

    const body = await request.json();
    const {
      referralId,
      amount,
      description,
      invoiceId,
      paymentMethod,
      paidAt
    } = body;

    // Validate required fields
    if (!referralId || !amount) {
      return NextResponse.json(
        { error: 'Referral ID and amount are required' },
        { status: 400 }
      );
    }

    // Get referral with association and partner group
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        affiliate: true
      }
    });

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    // Get partner group incentive rate
    const association = referral.association as any;
    let incentiveRate = 0.20; // Default 20%

    if (association.partnerGroupId) {
      const partnerGroup = await prisma.partnerGroup.findUnique({
        where: { id: association.partnerGroupId }
      });
      if (partnerGroup) {
        incentiveRate = partnerGroup.incentiveRate;
      }
    }

    // Calculate incentive
    const amountCents = Math.floor(Number(amount) * 100);
    const incentiveCents = Math.floor(amountCents * incentiveRate);

    // Create transaction
    const transaction = await (prisma as any).transaction.create({
      data: {
        referralId,
        associationId: referral.associationId,
        customerId: referral.subscriptionId,
        customerName: referral.leadName,
        customerEmail: referral.leadEmail,
        amountCents,
        incentiveCents,
        incentiveRate,
        status: 'COMPLETED',
        description,
        invoiceId,
        paymentMethod,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        createdBy: user.id
      }
    });

    // Also create a incentive record for tracking
    await prisma.conversion.create({
      data: {
        associationId: referral.associationId,
        referralId: referral.id,
        eventType: 'PURCHASE',
        amountCents,
        status: 'APPROVED',
        currency: 'INR',
        eventMetadata: {
          transactionId: transaction.id,
          incentiveCents,
          incentiveRate
        }
      }
    });

    // Send email notification to association
    try {
      const associationUser = await prisma.user.findUnique({
        where: { id: association.userId }
      });

      if (associationUser?.email) {
        const { emailService } = await import('@/lib/email');
        await emailService.sendTransactionCreatedEmail(associationUser.email, {
          associationName: association.name || associationUser.name || 'Partner',
          customerName: referral.leadName,
          amountCents,
          incentiveCents,
          incentiveRate,
          transactionId: transaction.id
        });
      }
    } catch (emailError) {
      console.error('Failed to send transaction email:', emailError);
      // Don't fail the transaction if email fails
    }

    return NextResponse.json({
      success: true,
      transaction,
      message: 'Transaction created successfully'
    });

  } catch (error) {
    console.error('Create transaction API error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// PUT - Update transaction
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
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

    const body = await request.json();
    const {
      id,
      status,
      description,
      invoiceId,
      paymentMethod,
      paidAt
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const transaction = await (prisma as any).transaction.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(description !== undefined && { description }),
        ...(invoiceId !== undefined && { invoiceId }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(paidAt && { paidAt: new Date(paidAt) })
      }
    });

    return NextResponse.json({
      success: true,
      transaction,
      message: 'Transaction updated successfully'
    });

  } catch (error) {
    console.error('Update transaction API error:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

// DELETE - Delete transaction
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    await (prisma as any).transaction.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully'
    });

  } catch (error) {
    console.error('Delete transaction API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
