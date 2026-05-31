import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/lib/otp';
import { SignJWT } from 'jose';
import { checkRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET!
);

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 verify attempts per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rateLimit = await checkRateLimit(ip, 'auth/verify-otp', 5, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString() } }
      );
    }

    const { email, code, skip } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // DEVELOPMENT MODE: Allow skip or empty code for direct login
    if (skip || !code) {
      // Get user details directly without OTP verification
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          affiliate: true
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 400 }
        );
      }

      // Generate JWT token
      const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(JWT_SECRET);

      // Set cookie
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hasAssociation: !!user.affiliate
        }
      });

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400, // 24 hours
        path: '/'
      });

      return response;
    }

    /* ORIGINAL OTP VERIFICATION CODE - COMMENTED OUT
    const result = await otpService.verifyOTP(email, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    const user = result.user!;

    // Generate JWT token
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    // Set cookie
    const response = NextResponse.json({
      success: true,
      message: result.message,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasAssociation: !!user.affiliate
      }
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/'
    });

    return response;
    */

  } catch (error) {
    console.error('OTP verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
