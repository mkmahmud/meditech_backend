import { z } from 'zod';

// Create Notification Schema
export const createNotificationSchema = z.object({
    userId: z.string().uuid('Invalid user ID format'),
    type: z.enum([
        'APPOINTMENT_REMINDER',
        'PRESCRIPTION_REMINDER',
        'LAB_RESULT',
        'PAYMENT_DUE',
        'GENERAL',
    ]),
    title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
    message: z.string().min(1, 'Message is required').max(1000, 'Message is too long'),
    data: z.string().optional(), // JSON string for additional data
    scheduledFor: z
        .string()
        .datetime({ message: 'Invalid datetime format' })
        .optional(),
});

export type CreateNotificationDto = z.infer<typeof createNotificationSchema>;

// Update Notification Schema
export const updateNotificationSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title is too long').optional(),
    message: z.string().min(1, 'Message is required').max(1000, 'Message is too long').optional(),
    data: z.string().optional(),
    scheduledFor: z
        .string()
        .datetime({ message: 'Invalid datetime format' })
        .optional(),
});

export type UpdateNotificationDto = z.infer<typeof updateNotificationSchema>;

// Mark as Read Schema
export const markAsReadSchema = z.object({
    notificationIds: z.array(z.string().uuid('Invalid notification ID format')).min(1, 'At least one notification ID is required'),
});

export type MarkAsReadDto = z.infer<typeof markAsReadSchema>;

// Get Notifications Query Schema
export const getNotificationsSchema = z.object({
    userId: z.string().uuid('Invalid user ID format').optional(),
    type: z.enum([
        'APPOINTMENT_REMINDER',
        'PRESCRIPTION_REMINDER',
        'LAB_RESULT',
        'PAYMENT_DUE',
        'GENERAL',
    ]).optional(),
    read: z
        .string()
        .transform((val) => val === 'true')
        .pipe(z.boolean())
        .optional(),
    limit: z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().positive().max(100))
        .optional()
        .default('20'),
    offset: z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().min(0))
        .optional()
        .default('0'),
});

export type GetNotificationsDto = z.infer<typeof getNotificationsSchema>;

// Get Notification By ID Schema
export const getNotificationByIdSchema = z.object({
    id: z.string().uuid('Invalid notification ID format'),
});

export type GetNotificationByIdDto = z.infer<typeof getNotificationByIdSchema>;

// Delete Notification Schema
export const deleteNotificationSchema = z.object({
    notificationIds: z.array(z.string().uuid('Invalid notification ID format')).min(1, 'At least one notification ID is required'),
});

export type DeleteNotificationDto = z.infer<typeof deleteNotificationSchema>;

// Send Bulk Notifications Schema
export const sendBulkNotificationsSchema = z.object({
    userIds: z.array(z.string().uuid('Invalid user ID format')).min(1, 'At least one user ID is required').max(1000, 'Too many users'),
    type: z.enum([
        'APPOINTMENT_REMINDER',
        'PRESCRIPTION_REMINDER',
        'LAB_RESULT',
        'PAYMENT_DUE',
        'GENERAL',
    ]),
    title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
    message: z.string().min(1, 'Message is required').max(1000, 'Message is too long'),
    data: z.string().optional(),
    scheduledFor: z
        .string()
        .datetime({ message: 'Invalid datetime format' })
        .optional(),
});

export type SendBulkNotificationsDto = z.infer<typeof sendBulkNotificationsSchema>;
