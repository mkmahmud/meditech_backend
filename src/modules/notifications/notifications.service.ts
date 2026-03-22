import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    CreateNotificationDto,
    UpdateNotificationDto,
    MarkAsReadDto,
    GetNotificationsDto,
    DeleteNotificationDto,
    SendBulkNotificationsDto,
} from './schemas/notifications.schema';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private prisma: PrismaService,
        private notificationsGateway: NotificationsGateway
    ) { }

    /**
     * Create a single notification
     */
    async createNotification(data: CreateNotificationDto) {
        // Verify user exists
        const user = await this.prisma.user.findUnique({
            where: { id: data.userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Validate data if provided (should be valid JSON)
        if (data.data) {
            try {
                JSON.parse(data.data);
            } catch (error) {
                throw new BadRequestException('Data must be a valid JSON string');
            }
        }

        const notification = await this.prisma.notification.create({
            data: {
                userId: data.userId,
                type: data.type as NotificationType,
                title: data.title,
                message: data.message,
                data: data.data,
                scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
                sentAt: data.scheduledFor ? null : new Date(),
            },
            select: {
                id: true,
                userId: true,
                type: true,
                title: true,
                message: true,
                data: true,
                read: true,
                readAt: true,
                scheduledFor: true,
                sentAt: true,
                createdAt: true,
            },
        });

        this.logger.log(`Notification created for user ${data.userId}`);
        this.notificationsGateway.sendNotificationToUser(data.userId, notification);

        return notification;
    }

    /**
     * Send bulk notifications to multiple users
     */
    async sendBulkNotifications(data: SendBulkNotificationsDto) {
        // Verify all users exist
        const users = await this.prisma.user.findMany({
            where: { id: { in: data.userIds } },
            select: { id: true },
        });

        if (users.length !== data.userIds.length) {
            throw new BadRequestException('One or more users not found');
        }

        // Validate data if provided
        if (data.data) {
            try {
                JSON.parse(data.data);
            } catch (error) {
                throw new BadRequestException('Data must be a valid JSON string');
            }
        }

        const notifications = await this.prisma.notification.createMany({
            data: data.userIds.map((userId) => ({
                userId,
                type: data.type as NotificationType,
                title: data.title,
                message: data.message,
                data: data.data,
                scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
                sentAt: data.scheduledFor ? null : new Date(),
            })),
        });

        this.logger.log(`${notifications.count} bulk notifications created`);
        return {
            message: 'Bulk notifications sent successfully',
            count: notifications.count,
        };
    }

    /**
     * Get notifications with filters and pagination
     */
    async getNotifications(query: GetNotificationsDto) {
        const { userId, type, read, limit, offset } = query;

        const where: any = {};

        if (userId) {
            where.userId = userId;
        }

        if (type) {
            where.type = type;
        }

        if (read !== undefined) {
            where.read = read;
        }

        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                select: {
                    id: true,
                    userId: true,
                    type: true,
                    title: true,
                    message: true,
                    data: true,
                    read: true,
                    readAt: true,
                    scheduledFor: true,
                    sentAt: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: Number(limit),
                skip: Number(offset),
            }),
            this.prisma.notification.count({ where }),
        ]);

        return {
            data: notifications,
            total,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + notifications.length < total,
        };
    }

    /**
     * Get a single notification by ID
     */
    async getNotificationById(id: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                type: true,
                title: true,
                message: true,
                data: true,
                read: true,
                readAt: true,
                scheduledFor: true,
                sentAt: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        return notification;
    }

    /**
     * Get notifications for a specific user
     */
    async getUserNotifications(userId: string, read?: boolean) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const where: any = { userId };

        if (read !== undefined) {
            where.read = read;
        }

        const notifications = await this.prisma.notification.findMany({
            where,
            select: {
                id: true,
                type: true,
                title: true,
                message: true,
                data: true,
                read: true,
                readAt: true,
                scheduledFor: true,
                sentAt: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return notifications;
    }

    /**
     * Get unread notification count for a user
     */
    async getUnreadCount(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const count = await this.prisma.notification.count({
            where: {
                userId,
                read: false,
            },
        });

        return { userId, unreadCount: count };
    }

    /**
     * Mark notifications as read
     */
    async markAsRead(data: MarkAsReadDto) {
        // Verify notifications exist
        const notifications = await this.prisma.notification.findMany({
            where: { id: { in: data.notificationIds } },
            select: { id: true },
        });

        if (notifications.length !== data.notificationIds.length) {
            throw new NotFoundException('One or more notifications not found');
        }

        const updated = await this.prisma.notification.updateMany({
            where: { id: { in: data.notificationIds } },
            data: {
                read: true,
                readAt: new Date(),
            },
        });

        this.logger.log(`${updated.count} notifications marked as read`);
        return {
            message: 'Notifications marked as read',
            count: updated.count,
        };
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updated = await this.prisma.notification.updateMany({
            where: {
                userId,
                read: false,
            },
            data: {
                read: true,
                readAt: new Date(),
            },
        });

        this.logger.log(
            `All ${updated.count} notifications marked as read for user ${userId}`,
        );
        return {
            message: 'All notifications marked as read',
            count: updated.count,
        };
    }

    /**
     * Update a notification
     */
    async updateNotification(id: string, data: UpdateNotificationDto) {
        const notification = await this.prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        // Validate data if provided
        if (data.data) {
            try {
                JSON.parse(data.data);
            } catch (error) {
                throw new BadRequestException('Data must be a valid JSON string');
            }
        }

        const updated = await this.prisma.notification.update({
            where: { id },
            data: {
                title: data.title,
                message: data.message,
                data: data.data,
                scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
            },
            select: {
                id: true,
                userId: true,
                type: true,
                title: true,
                message: true,
                data: true,
                read: true,
                readAt: true,
                scheduledFor: true,
                sentAt: true,
                createdAt: true,
            },
        });

        this.logger.log(`Notification ${id} updated`);
        return updated;
    }

    /**
     * Delete notifications
     */
    async deleteNotifications(data: DeleteNotificationDto) {
        // Verify notifications exist
        const notifications = await this.prisma.notification.findMany({
            where: { id: { in: data.notificationIds } },
            select: { id: true },
        });

        if (notifications.length !== data.notificationIds.length) {
            throw new NotFoundException('One or more notifications not found');
        }

        const deleted = await this.prisma.notification.deleteMany({
            where: { id: { in: data.notificationIds } },
        });

        this.logger.log(`${deleted.count} notifications deleted`);
        return {
            message: 'Notifications deleted successfully',
            count: deleted.count,
        };
    }

    /**
     * Delete a single notification
     */
    async deleteNotification(id: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        await this.prisma.notification.delete({
            where: { id },
        });

        this.logger.log(`Notification ${id} deleted`);
        return { message: 'Notification deleted successfully' };
    }

    /**
     * Cron job to send scheduled notifications
     * Runs every minute to check for scheduled notifications
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async sendScheduledNotifications() {
        const now = new Date();

        const scheduledNotifications = await this.prisma.notification.findMany({
            where: {
                sentAt: null,
                scheduledFor: {
                    lte: now,
                },
            },
        });

        if (scheduledNotifications.length > 0) {
            await this.prisma.notification.updateMany({
                where: {
                    id: { in: scheduledNotifications.map((n) => n.id) },
                },
                data: {
                    sentAt: now,
                },
            });

            this.logger.log(
                `Sent ${scheduledNotifications.length} scheduled notifications`,
            );
        }
    }

    /**
     * Clean up old read notifications
     * Runs daily to delete read notifications older than 30 days
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupOldNotifications() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deleted = await this.prisma.notification.deleteMany({
            where: {
                read: true,
                readAt: {
                    lt: thirtyDaysAgo,
                },
            },
        });

        this.logger.log(
            `Cleaned up ${deleted.count} old read notifications`,
        );
    }
}
