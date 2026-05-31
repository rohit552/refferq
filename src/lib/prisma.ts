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
    role: 'ADMIN' | 'ASSOCIATION';
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
        association: true,
      },
    });
  }

  async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        association: true,
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
    school-leadCode: string;
    payoutDetails?: any;
  }) {
    return await prisma.association.create({
      data: {
        userId: associationData.userId,
        school-leadCode: associationData.school-leadCode,
        payoutDetails: associationData.payoutDetails || {},
      },
    });
  }

  async getAssociationByUserId(userId: string) {
    return await prisma.association.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });
  }

  async getAssociationBySchool LeadCode(code: string) {
    return await prisma.association.findUnique({
      where: { school-leadCode: code },
      include: {
        user: true,
      },
    });
  }

  async getAllAssociations() {
    return await prisma.association.findMany({
      include: {
        user: true,
      },
    });
  }

  async updateAssociation(id: string, updates: Parameters<typeof prisma.association.update>[0]['data']) {
    return await prisma.association.update({
      where: { id },
      data: updates,
    });
  }

  // School Lead operations
  async createSchool Lead(school-leadData: {
    associationId: string;
    leadName: string;
    leadEmail: string;
    metadata?: any;
  }) {
    return await prisma.school-lead.create({
      data: {
        associationId: school-leadData.associationId,
        leadName: school-leadData.leadName,
        leadEmail: school-leadData.leadEmail,
        metadata: school-leadData.metadata || {},
        status: 'PENDING',
      },
    });
  }

  async getSchool LeadById(id: string) {
    return await prisma.school-lead.findUnique({
      where: { id },
      include: {
        association: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async getSchool LeadsByAssociation(associationId: string) {
    return await prisma.school-lead.findMany({
      where: { associationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingSchool Leads() {
    return await prisma.school-lead.findMany({
      where: { status: 'PENDING' },
      include: {
        association: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSchool Lead(id: string, updates: Parameters<typeof prisma.school-lead.update>[0]['data']) {
    return await prisma.school-lead.update({
      where: { id },
      data: updates,
    });
  }

  // Conversion operations
  async createConversion(conversionData: {
    associationId: string;
    school-leadId?: string;
    eventType: 'SIGNUP' | 'PURCHASE' | 'TRIAL' | 'LEAD';
    amountCents: number;
    currency?: string;
    eventMetadata?: any;
  }) {
    return await prisma.conversion.create({
      data: {
        associationId: conversionData.associationId,
        school-leadId: conversionData.school-leadId,
        eventType: conversionData.eventType,
        amountCents: conversionData.amountCents,
        currency: conversionData.currency || 'USD',
        eventMetadata: conversionData.eventMetadata || {},
        status: 'PENDING',
      },
    });
  }

  async getConversionsByAssociation(associationId: string) {
    return await prisma.conversion.findMany({
      where: { associationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Incentive operations
  async createIncentive(incentiveData: {
    conversionId: string;
    associationId: string;
    userId: string;
    amountCents: number;
    rate: number;
    approvedBy?: string;
  }) {
    return await prisma.incentive.create({
      data: {
        conversionId: incentiveData.conversionId,
        associationId: incentiveData.associationId,
        userId: incentiveData.userId,
        amountCents: incentiveData.amountCents,
        rate: incentiveData.rate,
        status: incentiveData.approvedBy ? 'APPROVED' : 'PENDING',
        approvedBy: incentiveData.approvedBy,
        approvedAt: incentiveData.approvedBy ? new Date() : undefined,
      },
    });
  }

  async getIncentivesByAssociation(associationId: string) {
    return await prisma.incentive.findMany({
      where: { associationId },
      include: {
        conversion: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingIncentives() {
    return await prisma.incentive.findMany({
      where: { status: 'PENDING' },
      include: {
        association: {
          include: {
            user: true,
          },
        },
        conversion: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateIncentive(id: string, updates: Parameters<typeof prisma.incentive.update>[0]['data']) {
    return await prisma.incentive.update({
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
    return await prisma.incentiveRule.create({
      data: ruleData,
    });
  }

  async getIncentiveRules() {
    return await prisma.incentiveRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDefaultIncentiveRule() {
    return await prisma.incentiveRule.findFirst({
      where: { isDefault: true },
    });
  }

  // Payout operations
  async createPayout(payoutData: {
    userId: string;
    associationId: string;
    amountCents: number;
    incentiveCount: number;
    method?: string;
    notes?: string;
    createdBy: string;
  }) {
    return await prisma.payout.create({
      data: {
        userId: payoutData.userId,
        associationId: payoutData.associationId,
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
  async createSchool LeadClick(clickData: {
    school-leadId: string;
    ipAddress: string;
    userAgent?: string;
    referer?: string;
    metadata?: any;
  }) {
    return await prisma.school-leadClick.create({
      data: {
        school-leadId: clickData.school-leadId,
        ipAddress: clickData.ipAddress,
        userAgent: clickData.userAgent,
        referer: clickData.referer,
        metadata: clickData.metadata || {},
      },
    });
  }

  async getClicksBySchool LeadId(school-leadId: string) {
    return await prisma.school-leadClick.findMany({
      where: { school-leadId },
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
  async getAssociationStats(associationId: string) {
    const association = await this.getAssociationByUserId(associationId);
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
      prisma.school-leadClick.count({
        where: {
          school-lead: {
            associationId: association.id
          }
        },
      }),
      prisma.conversion.count({
        where: { associationId: association.id },
      }),
      prisma.incentive.findMany({
        where: { associationId: association.id },
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
      totalSchool Leads,
      pendingSchool Leads,
      approvedSchool Leads,
      totalConversions,
      totalIncentives,
      clicks,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'ASSOCIATION' } }),
      prisma.user.count({ where: { role: 'ASSOCIATION', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'ASSOCIATION', status: 'INACTIVE' } }),
      prisma.school-lead.count(),
      prisma.school-lead.count({ where: { status: 'PENDING' } }),
      prisma.school-lead.count({ where: { status: 'APPROVED' } }),
      prisma.conversion.count(),
      prisma.incentive.count(),
      prisma.school-leadClick.count(),
    ]);

    const conversions = await prisma.conversion.findMany({
      select: { amountCents: true },
    });

    const totalRevenue = conversions.reduce((sum: number, c: any) => sum + c.amountCents, 0);

    return {
      totalAssociations,
      activeAssociations,
      pendingAssociations,
      totalSchool Leads,
      pendingSchool Leads,
      approvedSchool Leads,
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
        role: 'ASSOCIATION',
      });

      const association2User = await this.createUser({
        email: 'david.lee@example.com',
        password: 'password',
        name: 'David Lee',
        role: 'ASSOCIATION',
      });

      // Update association users to active
      await this.updateUser(association1User.id, { status: 'ACTIVE' });
      await this.updateUser(association2User.id, { status: 'ACTIVE' });

      // Create association profiles
      const association1 = await this.createAssociation({
        userId: association1User.id,
        school-leadCode: 'SARAH-TECH',
        payoutDetails: {
          method: 'bank_transfer',
          bankAccount: '*****1234',
          routingNumber: '123456789',
        },
      });

      const association2 = await this.createAssociation({
        userId: association2User.id,
        school-leadCode: 'DAVID-SALES',
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
            minMonthlySchool Leads: 10,
          },
        },
      });

      // Create sample school-leads
      const school-lead1 = await this.createSchool Lead({
        associationId: association1.id,
        leadName: 'John Smith',
        leadEmail: 'john@techcorp.com',
        metadata: {
          company: 'TechCorp',
          notes: 'Enterprise client, high value lead',
          estimatedValue: 150000,
        },
      });

      const school-lead2 = await this.createSchool Lead({
        associationId: association2.id,
        leadName: 'Maria Garcia',
        leadEmail: 'maria@startup.io',
        metadata: {
          company: 'StartupXYZ',
          notes: 'Interested in premium plan',
          estimatedValue: 80000,
        },
      });

      // Approve one school-lead and create conversion
      await this.updateSchool Lead(school-lead2.id, {
        status: 'APPROVED',
        reviewedBy: adminUser.id,
        reviewedAt: new Date(),
        reviewNotes: 'Approved - verified lead quality',
      });

      // Create conversion for approved school-lead
      const conversion = await this.createConversion({
        associationId: association1.id,
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
        associationId: association1.id,
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
      await this.createSchool LeadClick({
        school-leadId: school-lead1.id, // Use school-lead ID instead of school-lead code
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: { attributionKey: `attr_${Date.now()} ` },
      });

      console.log('Database seeded successfully with sample data');
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
  }
}

export const db = new DatabaseService();