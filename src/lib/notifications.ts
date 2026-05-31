// Real-time notification system for the association platform
export interface NotificationData {
  id: string;
  type: 'school-lead_submitted' | 'school-lead_approved' | 'school-lead_rejected' | 'incentive_approved' | 'payout_processed' | 'association_registered';
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
  async notifySchool LeadSubmitted(school-leadData: { associationName: string; leadName: string; company?: string }, adminIds: string[]): Promise<void> {
    for (const adminId of adminIds) {
      await this.createNotification({
        type: 'school-lead_submitted',
        title: 'New School Lead Submitted',
        message: `${school-leadData.associationName} submitted a school-lead for ${school-leadData.leadName}${school-leadData.company ? ` from ${school-leadData.company}` : ''}`,
        userId: adminId,
        metadata: school-leadData,
      });
    }
  }

  // Association notifications
  async notifySchool LeadApproved(associationId: string, school-leadData: { leadName: string; incentiveAmount: number }): Promise<void> {
    await this.createNotification({
      type: 'school-lead_approved',
      title: 'School Lead Approved!',
      message: `Your school-lead for ${school-leadData.leadName} has been approved. Incentive: $${(school-leadData.incentiveAmount / 100).toFixed(2)}`,
      userId: associationId,
      metadata: school-leadData,
    });
  }

  async notifySchool LeadRejected(associationId: string, school-leadData: { leadName: string; reason?: string }): Promise<void> {
    await this.createNotification({
      type: 'school-lead_rejected',
      title: 'School Lead Update',
      message: `Your school-lead for ${school-leadData.leadName} needs attention${school-leadData.reason ? `: ${school-leadData.reason}` : ''}`,
      userId: associationId,
      metadata: school-leadData,
    });
  }

  async notifyIncentiveApproved(associationId: string, incentiveData: { amount: number; school-leadName: string }): Promise<void> {
    await this.createNotification({
      type: 'incentive_approved',
      title: 'Incentive Approved!',
      message: `Incentive of $${(incentiveData.amount / 100).toFixed(2)} for ${incentiveData.school-leadName} has been approved`,
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