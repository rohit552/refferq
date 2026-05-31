import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


async function verifyAdmin(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN') return null;
    return user;
  } catch (_e) { return null; }
}

// POST - Process a refund for a transaction
// Automatically reverses associated incentives
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { transactionId, reason } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ success: false, error: 'Transaction ID is required' }, { status: 400 });
    }

    // Get transaction
    const transaction = await (prisma as any).transaction.findUnique({
      where: { id: transactionId },
      include: { association: true },
    });

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.status === 'REFUNDED') {
      return NextResponse.json({ success: false, error: 'Transaction already refunded' }, { status: 400 });
    }

    // Find associated incentives for this association that are pending/approved
    const incentives = await prisma.incentive.findMany({
      where: {
        associationId: transaction.associationId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    const results = {
      transactionRefunded: false,
      incentiveReversed: false,
      balanceDeducted: false,
      reversedIncentiveId: null as string | null,
      reversedAmountCents: 0,
      deductedAmountCents: 0,
    };

    // 1. Mark transaction as REFUNDED
    await (prisma as any).transaction.update({
      where: { id: transactionId },
      data: {
        status: 'REFUNDED',
        description: `${transaction.description || ''} [REFUNDED: ${reason || 'No reason provided'}]`.trim(),
      },
    });
    results.transactionRefunded = true;

    // 2. Reverse associated incentive (mark as CANCELLED)
    if (incentives.length > 0) {
      const matchingIncentive = incentives[0]; // Take most recent matching
      await prisma.incentive.update({
        where: { id: matchingIncentive.id },
        data: { status: 'CANCELLED' },
      });
      results.incentiveReversed = true;
      results.reversedIncentiveId = matchingIncentive.id;
      results.reversedAmountCents = matchingIncentive.amountCents;

      // 3. Deduct from association balance if applicable
      const association = await prisma.affiliate.findUnique({
        where: { id: transaction.associationId },
      });

      if (association && association.balanceCents >= matchingIncentive.amountCents) {
        await prisma.affiliate.update({
          where: { id: transaction.associationId },
          data: {
            balanceCents: { decrement: matchingIncentive.amountCents },
          },
        });
        results.balanceDeducted = true;
        results.deductedAmountCents = matchingIncentive.amountCents;
      }
    }

    // 4. Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'TRANSACTION_REFUNDED',
        objectType: 'transaction',
        objectId: transactionId,
        payload: {
          reason: reason || 'No reason provided',
          transactionAmountCents: transaction.amountCents,
          incentiveReversed: results.incentiveReversed,
          reversedAmountCents: results.reversedAmountCents,
          balanceDeducted: results.balanceDeducted,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Refund processed successfully',
      results,
    });
  } catch (error) {
    console.error('Refund processing error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process refund' }, { status: 500 });
  }
}

// GET - List refunded transactions
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const transactions = await (prisma as any).transaction.findMany({
      where: { status: 'REFUNDED' },
      include: { association: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('Failed to fetch refunded transactions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch refunds' }, { status: 500 });
  }
}
