import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import crypto from 'crypto';

// ─── Webhook Signature Verification ────────────────────────────
function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    try {
        return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch (_e) {
        return false;
    }
}

/**
 * POST /api/webhook/refund
 * 
 * Receives refund events from payment providers (Stripe, etc.) and
 * automatically reverses or claws back the associated incentive.
 * 
 * Expected body:
 * {
 *   customer_email: string,         // Email of the customer who refunded
 *   referral_code?: string,         // Referral code (optional, for faster lookup)
 *   amount_cents: number,           // Refund amount in cents
 *   reason?: string,                // Reason for refund
 *   external_id?: string,           // Payment provider's refund ID
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // ─── Authentication ────────────────────────────────────────
        const rawBody = await request.text();
        const webhookSecret = process.env.WEBHOOK_SECRET;
        const signature = request.headers.get('x-webhook-signature') || request.headers.get('x-refferq-signature');
        const apiKey = request.headers.get('x-api-key');

        let authenticated = false;

        if (apiKey) {
            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            const key = await prisma.apiKey.findFirst({
                where: { keyHash, isActive: true },
            }).catch(() => null);
            authenticated = !!key;
        }

        if (!authenticated && webhookSecret && signature) {
            authenticated = verifyWebhookSignature(rawBody, signature, webhookSecret);
        }

        if (!authenticated) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // ─── Parse & Validate ──────────────────────────────────────
        const body = JSON.parse(rawBody);
        const {
            customer_email,
            referral_code,
            amount_cents,
            reason = 'Customer refund',
            external_id,
        } = body;

        if (!customer_email) {
            return NextResponse.json(
                { success: false, message: 'customer_email is required' },
                { status: 400 }
            );
        }

        // ─── Find Related Conversions ──────────────────────────────
        // Strategy: find conversions by customer email in event_metadata
        const conversions = await prisma.conversion.findMany({
            where: {
                eventMetadata: {
                    path: ['customerEmail'],
                    equals: customer_email,
                },
            },
            include: {
                commissions: true,
                affiliate: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (conversions.length === 0) {
            console.log('Refund webhook: no conversions found for', customer_email);
            return NextResponse.json({
                success: true,
                message: 'Refund logged (no matching conversion found)',
                reversed: 0,
            });
        }

        // ─── Process Refund for Each Incentive ────────────────────
        let reversedCount = 0;
        let totalReversedCents = 0;
        const results: Array<{ incentiveId: string; action: string; amountCents: number }> = [];

        for (const conversion of conversions) {
            for (const incentive of conversion.commissions) {
                // Skip already cancelled/clawedback incentives
                if (incentive.status === 'CANCELLED' || incentive.status === 'CLAWBACK') {
                    results.push({ incentiveId: incentive.id, action: 'already_cancelled', amountCents: 0 });
                    continue;
                }

                if (incentive.status === 'PENDING') {
                    // ── Case 1: Still in hold period → simply cancel (no balance impact)
                    await prisma.commission.update({
                        where: { id: incentive.id },
                        data: {
                            status: 'CANCELLED',
                            clawbackNote: `Refund: ${reason}. External ID: ${external_id || 'N/A'}`,
                        },
                    });

                    results.push({ incentiveId: incentive.id, action: 'cancelled_pending', amountCents: incentive.amountCents });

                } else if (incentive.status === 'APPROVED') {
                    // ── Case 2: Already approved (in balance) → cancel + deduct from balance
                    await prisma.commission.update({
                        where: { id: incentive.id },
                        data: {
                            status: 'CANCELLED',
                            clawbackNote: `Refund clawback: ${reason}. External ID: ${external_id || 'N/A'}`,
                        },
                    });

                    // Deduct from association balance
                    await prisma.affiliate.update({
                        where: { id: incentive.affiliateId },
                        data: {
                            balanceCents: { decrement: incentive.amountCents },
                        },
                    });

                    results.push({ incentiveId: incentive.id, action: 'clawback_approved', amountCents: incentive.amountCents });

                } else if (incentive.status === 'PAID') {
                    // ── Case 3: Already paid out → create negative balance (clawback for next payout)
                    await prisma.commission.update({
                        where: { id: incentive.id },
                        data: {
                            status: 'CLAWBACK',
                            clawbackNote: `Paid incentive clawback: ${reason}. Will be deducted from next payout. External ID: ${external_id || 'N/A'}`,
                        },
                    });

                    // Create negative balance to offset next payout
                    await prisma.affiliate.update({
                        where: { id: incentive.affiliateId },
                        data: {
                            balanceCents: { decrement: incentive.amountCents },
                        },
                    });

                    results.push({ incentiveId: incentive.id, action: 'clawback_paid', amountCents: incentive.amountCents });
                }

                reversedCount++;
                totalReversedCents += incentive.amountCents;
            }

            // Update conversion status
            await prisma.conversion.update({
                where: { id: conversion.id },
                data: { status: 'REJECTED' },
            });
        }

        // ─── Audit Log ─────────────────────────────────────────────
        await logAuditAction({
            actorId: 'system-webhook',
            action: 'REFUND_PROCESSED',
            objectType: 'REFUND',
            objectId: external_id || `refund-${Date.now()}`,
            payload: {
                customer_email,
                referral_code,
                amount_cents,
                reason,
                reversedCount,
                totalReversedCents,
                results,
            },
        });

        // ─── Send email notification to affected associations ────────
        try {
            const affectedAssociationIds = [...new Set(conversions.map(c => c.affiliateId))];
            for (const affId of affectedAssociationIds) {
                const associationUser = await prisma.user.findFirst({
                    where: { affiliate: { id: affId } },
                });
                if (associationUser?.email) {
                    const { emailService } = await import('@/lib/email');
                    await emailService.sendGenericEmail(associationUser.email, {
                        subject: 'Incentive Reversed — Customer Refund',
                        body: `A incentive has been reversed due to a customer refund. Reason: ${reason}. This has been reflected in your balance.`,
                    });
                }
            }
        } catch (emailErr) {
            console.error('Failed to send refund notification emails:', emailErr);
        }

        return NextResponse.json({
            success: true,
            message: `Refund processed: ${reversedCount} incentive(s) reversed`,
            reversed: reversedCount,
            totalReversedCents,
            details: results,
        });
    } catch (error) {
        console.error('Refund webhook error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to process refund' },
            { status: 500 }
        );
    }
}
