import { PrismaClient } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import * as bcrypt from 'bcryptjs';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization — avoids crashing at import time when DATABASE_URL
// is unavailable (e.g. during Docker build prerendering)
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getPrismaClient(), prop);
  },
});

// Database service class with Prisma methods
export class DatabaseService {
  // User operations
  async createUser(userData: {
    email: string;
    password: string; // Already hashed by the caller/AuthService
    name: string;
    role: 'ADMIN' | 'AFFILIATE';
  }) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role,
        status: userData.role === 'ADMIN' ? 'ACTIVE' : 'INACTIVE',
      },
    });

    return user;
  }

  async getUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        affiliate: true,
      },
    });
  }

  async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        affiliate: true,
      },
    });
  }

  async updateUser(id: string, updates: Parameters<typeof prisma.user.update>[0]['data']) {
    return await prisma.user.update({
      where: { id },
      data: updates,
    });
  }

  async verifyPassword(password: string, hashedPassword: string) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Association operations
  async createAssociation(associationData: {
    userId: string;
    referralCode: string;
    payoutDetails?: any;
  }) {
    return await prisma.affiliate.create({
      data: {
        userId: associationData.userId,
        referralCode: associationData.referralCode,
        payoutDetails: associationData.payoutDetails || {},
      },
    });
  }

  async getAssociationByUserId(userId: string) {
    return await prisma.affiliate.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });
  }

  async getAssociationByReferralCode(code: string) {
    return await prisma.affiliate.findUnique({
      where: { referralCode: code },
      include: {
        user: true,
      },
    });
  }

  async getAllAssociations() {
    return await prisma.affiliate.findMany({
      include: {
        user: true,
      },
    });
  }

  async updateAssociation(id: string, updates: Parameters<typeof prisma.affiliate.update>[0]['data']) {
    return await prisma.affiliate.update({
      where: { id },
      data: updates,
    });
  }

  // Referral operations
  async createSchoolLead(schoolLeadData: {
    affiliateId: string;
    leadName: string;
    leadEmail: string;
    metadata?: any;
  }) {
    return await prisma.referral.create({
      data: {
        affiliateId: schoolLeadData.affiliateId,
        leadName: schoolLeadData.leadName,
        leadEmail: schoolLeadData.leadEmail,
        metadata: schoolLeadData.metadata || {},
        status: 'PENDING',
      },
    });
  }

  async getSchoolLeadById(id: string) {
    return await prisma.referral.findUnique({
      where: { id },
      include: {
        affiliate: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async getSchoolLeadsByAssociation(affiliateId: string) {
    return await prisma.referral.findMany({
      where: { affiliateId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingSchoolLeads() {
    return await prisma.referral.findMany({
      where: { status: 'PENDING' },
      include: {
        affiliate: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSchoolLead(id: string, updates: Parameters<typeof prisma.referral.update>[0]['data']) {
    return await prisma.referral.update({
      where: { id },
      data: updates,
    });
  }

  // Conversion operations
  async createConversion(conversionData: {
    affiliateId: string;
    referralId?: string;
    eventType: 'SIGNUP' | 'PURCHASE' | 'TRIAL' | 'LEAD';
    amountCents: number;
    currency?: string;
    eventMetadata?: any;
  }) {
    return await prisma.conversion.create({
      data: {
        affiliateId: conversionData.affiliateId,
        referralId: conversionData.referralId,
        eventType: conversionData.eventType,
        amountCents: conversionData.amountCents,
        currency: conversionData.currency || 'USD',
        eventMetadata: conversionData.eventMetadata || {},
        status: 'PENDING',
      },
    });
  }

  async getConversionsByAssociation(affiliateId: string) {
    return await prisma.conversion.findMany({
      where: { affiliateId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Incentive operations
  async createIncentive(incentiveData: {
    conversionId: string;
    affiliateId: string;
    userId: string;
    amountCents: number;
    rate: number;
    approvedBy?: string;
  }) {
    return await prisma.commission.create({
      data: {
        conversionId: incentiveData.conversionId,
        affiliateId: incentiveData.affiliateId,
        userId: incentiveData.userId,
        amountCents: incentiveData.amountCents,
        rate: incentiveData.rate,
        status: incentiveData.approvedBy ? 'APPROVED' : 'PENDING',
        approvedBy: incentiveData.approvedBy,
        approvedAt: incentiveData.approvedBy ? new Date() : undefined,
      },
    });
  }

  async getIncentivesByAssociation(affiliateId: string) {
    return await prisma.commission.findMany({
      where: { affiliateId },
      include: {
        conversion: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingIncentives() {
    return await prisma.commission.findMany({
      where: { status: 'PENDING' },
      include: {
        affiliate: {
          include: {
            user: true,
          },
        },
        conversion: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateIncentive(id: string, updates: Parameters<typeof prisma.commission.update>[0]['data']) {
    return await prisma.commission.update({
      where: { id },
      data: updates,
    });
  }

  // Incentive Rules
  async createIncentiveRule(ruleData: {
    name: string;
    type: 'PERCENTAGE' | 'FIXED';
    value: number;
    conditions?: any;
    isDefault?: boolean;
  }) {
    return await prisma.commissionRule.create({
      data: ruleData,
    });
  }

  async getIncentiveRules() {
    return await prisma.commissionRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDefaultIncentiveRule() {
    return await prisma.commissionRule.findFirst({
      where: { isDefault: true },
    });
  }

  // Payout operations
  async createPayout(payoutData: {
    userId: string;
    affiliateId: string;
    amountCents: number;
    incentiveCount: number;
    method?: string;
    notes?: string;
    createdBy: string;
  }) {
    return await prisma.payout.create({
      data: {
        userId: payoutData.userId,
        affiliateId: payoutData.affiliateId,
        amountCents: payoutData.amountCents,
        incentiveCount: payoutData.incentiveCount,
        method: payoutData.method || 'Bank Transfer',
        notes: payoutData.notes,
        status: 'PENDING',
        createdBy: payoutData.createdBy,
      },
    });
  }

  async getPayoutsByUser(userId: string) {
    return await prisma.payout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Tracking operations
  async createReferralClick(clickData: {
    referralId: string;
    ipAddress: string;
    userAgent?: string;
    referer?: string;
    metadata?: any;
  }) {
    return await prisma.referralClick.create({
      data: {
        referralId: clickData.referralId,
        ipAddress: clickData.ipAddress,
        userAgent: clickData.userAgent,
        referer: clickData.referer,
        metadata: clickData.metadata || {},
      },
    });
  }

  async getClicksByReferralId(referralId: string) {
    return await prisma.referralClick.findMany({
      where: { referralId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Audit log operations
  async createAuditLog(logData: {
    actorId: string;
    action: string;
    objectType: string;
    objectId: string;
    payload?: any;
  }) {
    return await prisma.auditLog.create({
      data: {
        actorId: logData.actorId,
        action: logData.action,
        objectType: logData.objectType,
        objectId: logData.objectId,
        payload: logData.payload || {},
      },
    });
  }

  // Settings operations
  getPlatformSettings = unstable_cache(
    async () => {
      // Return the first program's settings as default
      return await prisma.programSettings.findFirst();
    },
    ['platform-settings'],
    { tags: ['platform-settings'], revalidate: 3600 }
  );

  getProgramSettings = unstable_cache(
    async (programId: string) => {
      return await prisma.programSettings.findUnique({
        where: { programId },
      });
    },
    ['program-settings'],
    { tags: ['program-settings'], revalidate: 3600 }
  );

  // Analytics and statistics
  async getAssociationStats(affiliateId: string) {
    const association = await this.getAssociationByUserId(affiliateId);
    if (!association) {
      return {
        totalClicks: 0,
        totalConversions: 0,
        conversionRate: 0,
        totalIncentives: 0,
        pendingIncentives: 0,
        approvedIncentives: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
      };
    }

    const [clicks, conversions, incentives] = await Promise.all([
      prisma.referralClick.count({
        where: {
          referral: {
            affiliateId: association.id
          }
        },
      }),
      prisma.conversion.count({
        where: { affiliateId: association.id },
      }),
      prisma.commission.findMany({
        where: { affiliateId: association.id },
      }),
    ]);

    const pendingIncentives = incentives.filter((c: any) => c.status === 'PENDING');
    const approvedIncentives = incentives.filter((c: any) => c.status === 'APPROVED');

    return {
      totalClicks: clicks,
      totalConversions: conversions,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      totalIncentives: incentives.length,
      pendingIncentives: pendingIncentives.length,
      approvedIncentives: approvedIncentives.length,
      totalEarnings: incentives.reduce((sum: number, c: any) => sum + c.amountCents, 0),
      pendingEarnings: pendingIncentives.reduce((sum: number, c: any) => sum + c.amountCents, 0),
    };
  }

  async getPlatformStats() {
    const [
      totalAssociations,
      activeAssociations,
      pendingAssociations,
      totalReferrals,
      pendingReferrals,
      approvedReferrals,
      totalConversions,
      totalIncentives,
      clicks,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'AFFILIATE' } }),
      prisma.user.count({ where: { role: 'AFFILIATE', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'AFFILIATE', status: 'INACTIVE' } }),
      prisma.referral.count(),
      prisma.referral.count({ where: { status: 'PENDING' } }),
      prisma.referral.count({ where: { status: 'APPROVED' } }),
      prisma.conversion.count(),
      prisma.commission.count(),
      prisma.referralClick.count(),
    ]);

    const conversions = await prisma.conversion.findMany({
      select: { amountCents: true },
    });

    const totalRevenue = conversions.reduce((sum: number, c: any) => sum + c.amountCents, 0);

    return {
      totalAssociations,
      activeAssociations,
      pendingAssociations,
      totalReferrals,
      pendingReferrals,
      approvedReferrals,
      totalConversions,
      totalIncentives,
      totalRevenue,
      conversionRate: clicks > 0 ? (totalConversions / clicks) * 100 : 0,
    };
  }

  // Seed data for development
  async seedDatabase() {
    try {
      // Check if data already exists
      const existingUsers = await prisma.user.count();
      if (existingUsers > 0) {
        console.log('Database already seeded');
        return;
      }

      // Create admin user
      const adminUser = await this.createUser({
        email: 'admin@example.com',
        password: 'password',
        name: 'Admin User',
        role: 'ADMIN',
      });

      // Create association users
      const association1User = await this.createUser({
        email: 'sarah.johnson@example.com',
        password: 'password',
        name: 'Sarah Johnson',
        role: 'AFFILIATE',
      });

      const association2User = await this.createUser({
        email: 'david.lee@example.com',
        password: 'password',
        name: 'David Lee',
        role: 'AFFILIATE',
      });

      // Update association users to active
      await this.updateUser(association1User.id, { status: 'ACTIVE' });
      await this.updateUser(association2User.id, { status: 'ACTIVE' });

      // Create association profiles
      const association1 = await this.createAssociation({
        userId: association1User.id,
        referralCode: 'SARAH-TECH',
        payoutDetails: {
          method: 'bank_transfer',
          bankAccount: '*****1234',
          routingNumber: '123456789',
        },
      });

      const association2 = await this.createAssociation({
        userId: association2User.id,
        referralCode: 'DAVID-SALES',
        payoutDetails: {
          method: 'stripe_connect',
          stripeAccountId: 'acct_1234567890',
        },
      });

      // Create incentive rules
      await this.createIncentiveRule({
        name: 'Standard Rate',
        type: 'PERCENTAGE',
        value: 15,
        isDefault: true,
      });

      await this.createIncentiveRule({
        name: 'Enterprise Tier',
        type: 'PERCENTAGE',
        value: 20,
        conditions: { minAmountCents: 500000 }, // $5000+
      });

      await this.createIncentiveRule({
        name: 'Bonus Rate',
        type: 'PERCENTAGE',
        value: 25,
        conditions: {
          tierRequirements: {
            minMonthlyReferrals: 10,
          },
        },
      });

      // Create sample school leads
      const schoolLead1 = await this.createSchoolLead({
        affiliateId: association1.id,
        leadName: 'John Smith',
        leadEmail: 'john@techcorp.com',
        metadata: {
          company: 'TechCorp',
          notes: 'Enterprise client, high value lead',
          estimatedValue: 150000,
        },
      });

      const schoolLead2 = await this.createSchoolLead({
        affiliateId: association2.id,
        leadName: 'Maria Garcia',
        leadEmail: 'maria@startup.io',
        metadata: {
          company: 'StartupXYZ',
          notes: 'Interested in premium plan',
          estimatedValue: 80000,
        },
      });

      // Approve one school lead and create conversion
      await this.updateSchoolLead(schoolLead2.id, {
        status: 'APPROVED',
        reviewedBy: adminUser.id,
        reviewedAt: new Date(),
        reviewNotes: 'Approved - verified lead quality',
      });

      // Create conversion for approved school lead
      const conversion = await this.createConversion({
        affiliateId: association1.id,
        eventType: 'PURCHASE',
        amountCents: 225000, // $2250
        eventMetadata: {
          customerId: 'cust_abc123',
          productId: 'prod_enterprise',
          planType: 'enterprise_annual',
        },
      });

      // Create incentive
      await this.createIncentive({
        conversionId: conversion.id,
        affiliateId: association1.id,
        userId: association1User.id,
        amountCents: 33750, // 15% of $2250
        rate: 15,
        approvedBy: adminUser.id,
      });

      // Update association balance
      await this.updateAssociation(association1.id, {
        balanceCents: 33750,
      });

      // Create sample clicks
      await this.createReferralClick({
        referralId: schoolLead1.id,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: { attributionKey: `attr_${Date.now()}` },
      });

      console.log('Database seeded successfully with sample data');
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
  }
}

export const db = new DatabaseService();
