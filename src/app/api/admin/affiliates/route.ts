import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    // Get user from database

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    // Fetch all associations with their user info and counts
    const associations = await prisma.affiliate.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            referrals: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get currency symbol
    const { getCurrencySymbol } = await import('@/lib/currency');
    const currencySymbol = await getCurrencySymbol();

    return NextResponse.json({
      success: true,
      associations,
      currencySymbol, // Add currency symbol to response
    });
  } catch (error) {
    console.error('Get associations API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch associations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    // Get user from database

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate with Zod
    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.associationCreateSchema.safeParse(body));

    if (!success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.issues },
        { status: 400 }
      );
    }

    const { name, email, password } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Generate password if not provided
    const crypto = await import('crypto');
    const userPassword = password || `AF${crypto.randomBytes(12).toString('base64url')}`;

    // Hash password with bcrypt
    const hashedPassword = await (await import('bcryptjs')).hash(userPassword, 12);

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role: 'ASSOCIATION',
        status: 'ACTIVE',
        password: hashedPassword
      }
    });

    // Create association profile
    const association = await prisma.affiliate.create({
      data: {
        userId: newUser.id,
        referralCode: `AF${Date.now()}${(await import('crypto')).randomBytes(3).toString('hex').toUpperCase().slice(0, 4)}`,
        balanceCents: 0,
        payoutDetails: {}
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Association created successfully',
      association: {
        id: association.id,
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        referralCode: association.referralCode,
        balanceCents: association.balanceCents,
        createdAt: association.createdAt
      },
      // Note: Password is sent to admin once and should be communicated
      // securely to the association. It is not stored in logs.
      temporaryPassword: userPassword
    });
  } catch (error) {
    console.error('Create association API error:', error);
    return NextResponse.json(
      { error: 'Failed to create association' },
      { status: 500 }
    );
  }
}