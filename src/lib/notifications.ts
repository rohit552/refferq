// Real-time notification system for the association platform
export interface NotificationData {
  id: string;
  type: 'referral_submitted' | 'referral_approved' | 'referral_rejected' | 'incentive_approved' | 'payout_processed' | 'association_registered';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  userId: string;
  metadata?: any;
}

class NotificationService {
  private readonly STORAGE_KEY = 'association_platform_notifications';

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNotifications(): NotificationData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (_e) {
      return [];
    }
  }

  private saveNotifications(notifications: NotificationData[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
  }

  async createNotification(data: Omit<NotificationData, 'id' | 'timestamp' | 'read'>): Promise<NotificationData> {
    const notification: NotificationData = {
      ...data,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      read: false,
    };

    const notifications = this.getNotifications();
    notifications.unshift(notification); // Add to beginning
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(100);
    }
    
    this.saveNotifications(notifications);
    return notification;
  }

  getNotificationsForUser(userId: string): NotificationData[] {
    const notifications = this.getNotifications();
    return notifications.filter(n => n.userId === userId);
  }

  getUnreadCount(userId: string): number {
    const userNotifications = this.getNotificationsForUser(userId);
    return userNotifications.filter(n => !n.read).length;
  }

  markAsRead(notificationId: string): void {
    const notifications = this.getNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.saveNotifications(notifications);
    }
  }

  markAllAsRead(userId: string): void {
    const notifications = this.getNotifications();
    notifications.forEach(n => {
      if (n.userId === userId) {
        n.read = true;
      }
    });
    this.saveNotifications(notifications);
  }

  // Admin notifications
  async notifyReferralSubmitted(referralData: { associationName: string; leadName: string; company?: string }, adminIds: string[]): Promise<void> {
    for (const adminId of adminIds) {
      await this.createNotification({
        type: 'referral_submitted',
        title: 'New Referral Submitted',
        message: `${referralData.associationName} submitted a referral for ${referralData.leadName}${referralData.company ? ` from ${referralData.company}` : ''}`,
        userId: adminId,
        metadata: referralData,
      });
    }
  }

  // Association notifications
  async notifyReferralApproved(associationId: string, referralData: { leadName: string; incentiveAmount: number }): Promise<void> {
    await this.createNotification({
      type: 'referral_approved',
      title: 'Referral Approved!',
      message: `Your referral for ${referralData.leadName} has been approved. Incentive: $${(referralData.incentiveAmount / 100).toFixed(2)}`,
      userId: associationId,
      metadata: referralData,
    });
  }

  async notifyReferralRejected(associationId: string, referralData: { leadName: string; reason?: string }): Promise<void> {
    await this.createNotification({
      type: 'referral_rejected',
      title: 'Referral Update',
      message: `Your referral for ${referralData.leadName} needs attention${referralData.reason ? `: ${referralData.reason}` : ''}`,
      userId: associationId,
      metadata: referralData,
    });
  }

  async notifyIncentiveApproved(associationId: string, incentiveData: { amount: number; referralName: string }): Promise<void> {
    await this.createNotification({
      type: 'incentive_approved',
      title: 'Incentive Approved!',
      message: `Incentive of $${(incentiveData.amount / 100).toFixed(2)} for ${incentiveData.referralName} has been approved`,
      userId: associationId,
      metadata: incentiveData,
    });
  }

  async notifyPayoutProcessed(associationId: string, payoutData: { amount: number; method: string }): Promise<void> {
    await this.createNotification({
      type: 'payout_processed',
      title: 'Payout Processed',
      message: `Your payout of $${(payoutData.amount / 100).toFixed(2)} via ${payoutData.method} has been processed`,
      userId: associationId,
      metadata: payoutData,
    });
  }

  // System notifications
  async notifyAssociationRegistered(adminIds: string[], associationData: { name: string; email: string }): Promise<void> {
    for (const adminId of adminIds) {
      await this.createNotification({
        type: 'association_registered',
        title: 'New Association Registration',
        message: `${associationData.name} (${associationData.email}) has registered as an association`,
        userId: adminId,
        metadata: associationData,
      });
    }
  }
}

export const notificationService = new NotificationService();