import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/nep/track
 *
 * Public, server-side event logging for the shareable SkillHeed NEP landing
 * page. Does NOT touch auth. Reuses the existing Referral + ReferralClick
 * tables: each partner-attributed event is stored as a ReferralClick with rich
 * NEP metadata (event type, level, state, district, school interest, campaign).
 *
 * Accepted event types:
 *   page_view | unique_visit | cta_click | school_interest | signup_intent | conversion
 *
 * Attribution params: partner_id (referral code), source, level, state,
 * district, campaign.
 */

const NEP_TRACKING_EMAIL_PREFIX = 'nep-';

interface NepTrackBody {
  eventType?: string;
  partnerId?: string;
  source?: string;
  level?: string;
  state?: string;
  district?: string;
  campaign?: string;
  schoolName?: string;
  schoolBoard?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  url?: string;
  visitorId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: NepTrackBody = await req.json();
    const eventType = (body.eventType || 'page_view').toLowerCase();

    const clientIP =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const cleanIP = clientIP.split(',')[0].trim();
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const referer = req.headers.get('referer') || null;

    const attribution = {
      source: body.source || 'direct',
      level: body.level || null,
      state: body.state || null,
      district: body.district || null,
      campaign: body.campaign || null,
      partner_id: body.partnerId || null,
    };

    // Resolve the partner (association) by referral code if provided.
    let association = null as Awaited<ReturnType<typeof prisma.affiliate.findUnique>> | null;
    if (body.partnerId) {
      association = await prisma.affiliate.findUnique({
        where: { referralCode: body.partnerId },
      });
    }

    // If we cannot attribute to a real partner, log to console and return.
    // (We never weaken auth or create fake users for unknown codes.)
    if (!association) {
      console.log('[v0] NEP event (unattributed):', { eventType, ...attribution });
      return NextResponse.json({ success: true, attributed: false });
    }

    // Find or create a stable per-partner NEP tracking referral bucket.
    const trackingEmail = `${NEP_TRACKING_EMAIL_PREFIX}${association.id}@tracking.internal`;
    let referral = await prisma.referral.findFirst({
      where: { affiliateId: association.id, leadEmail: trackingEmail },
    });

    if (!referral) {
      referral = await prisma.referral.create({
        data: {
          affiliateId: association.id,
          leadName: 'NEP Landing Visitor',
          leadEmail: trackingEmail,
          status: 'PENDING',
          metadata: {
            source: 'nep_landing',
            channel: '/nep',
            ...attribution,
          },
        },
      });
    }

    // For a school onboarding intent / signup, create a distinct lead referral
    // so it surfaces as a real lead in the partner pipeline.
    if (
      (eventType === 'school_interest' || eventType === 'signup_intent') &&
      (body.contactEmail || body.schoolName)
    ) {
      const lead = await prisma.referral.create({
        data: {
          affiliateId: association.id,
          leadName: body.contactName || body.schoolName || 'Referral',
          leadEmail:
            body.contactEmail || `nep-lead-${Date.now()}@tracking.internal`,
          leadPhone: body.contactPhone || null,
          status: 'PENDING',
          notes: `NEP school onboarding interest via /nep${
            body.schoolName ? ` — ${body.schoolName}` : ''
          }`,
          metadata: {
            source: 'nep_landing',
            event_type: eventType,
            school_name: body.schoolName || null,
            school_board: body.schoolBoard || null,
            ...attribution,
          },
        },
      });

      return NextResponse.json({
        success: true,
        attributed: true,
        leadId: lead.id,
        partner: association.referralCode,
      });
    }

    // Otherwise record an interaction click on the partner's NEP bucket.
    await prisma.referralClick.create({
      data: {
        referralId: referral.id,
        ipAddress: cleanIP,
        userAgent,
        referer,
        metadata: {
          channel: '/nep',
          event_type: eventType,
          visitor_id: body.visitorId || null,
          url: body.url || null,
          ...attribution,
        },
      },
    });

    return NextResponse.json({
      success: true,
      attributed: true,
      partner: association.referralCode,
    });
  } catch (error) {
    console.error('POST /api/nep/track error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track NEP event' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
