import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import {
    createNotificationSchema,
    updateNotificationSchema,
    markAsReadSchema,
    getNotificationsSchema,
    deleteNotificationSchema,
    sendBulkNotificationsSchema,
    CreateNotificationDto,
    UpdateNotificationDto,
    MarkAsReadDto,
    GetNotificationsDto,
    DeleteNotificationDto,
    SendBulkNotificationsDto,
} from './schemas/notifications.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    /**
     * Create a single notification
     * Admin/Doctor/Nurse can create notifications for any user
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE')
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a notification' })
    @ApiResponse({ status: 201, description: 'Notification created successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(createNotificationSchema))
    async createNotification(
        @Body() createNotificationDto: CreateNotificationDto,
    ) {
        return this.notificationsService.createNotification(createNotificationDto);
    }

    /**
     * Send bulk notifications to multiple users
     * Admin only
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN')
    @Post('bulk')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Send bulk notifications to multiple users' })
    @ApiResponse({
        status: 201,
        description: 'Bulk notifications sent successfully',
    })
    @ApiResponse({ status: 400, description: 'Invalid request data' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(sendBulkNotificationsSchema))
    async sendBulkNotifications(
        @Body() sendBulkNotificationsDto: SendBulkNotificationsDto,
    ) {
        return this.notificationsService.sendBulkNotifications(
            sendBulkNotificationsDto,
        );
    }

    /**
     * Get all notifications with filters and pagination
     * Admin can view all, others can only view their own
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PATIENT', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECHNICIAN')
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get notifications with filters' })
    @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
    async getNotifications(
        @Query(new ZodValidationPipe(getNotificationsSchema))
        query: GetNotificationsDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: string,
    ) {
        // If not admin, limit to user's own notifications
        if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
            query.userId = userId;
        }

        return this.notificationsService.getNotifications(query);
    }

    /**
     * Get current user's notifications
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    @Get('my-notifications')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get current user notifications' })
    @ApiResponse({
        status: 200,
        description: 'User notifications retrieved successfully',
    })
    async getMyNotifications(
        @CurrentUser('id') userId: string,
        @Query('read') read?: string,
    ) {
        const readBoolean =
            read !== undefined ? read === 'true' : undefined;
        return this.notificationsService.getUserNotifications(userId, readBoolean);
    }

    /**
     * Get unread notification count for current user
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    @Get('unread-count')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get unread notification count' })
    @ApiResponse({
        status: 200,
        description: 'Unread count retrieved successfully',
    })
    async getUnreadCount(@CurrentUser('id') userId: string) {
        return this.notificationsService.getUnreadCount(userId);
    }

    /**
     * Get a specific notification by ID
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get notification by ID' })
    @ApiResponse({ status: 200, description: 'Notification retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Notification not found' })
    async getNotificationById(@Param('id') id: string) {
        return this.notificationsService.getNotificationById(id);
    }

    /**
     * Mark notifications as read
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    @Put('mark-read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark notifications as read' })
    @ApiResponse({
        status: 200,
        description: 'Notifications marked as read successfully',
    })
    @ApiResponse({ status: 404, description: 'Notifications not found' })
    @UsePipes(new ZodValidationPipe(markAsReadSchema))
    async markAsRead(@Body() markAsReadDto: MarkAsReadDto) {
        return this.notificationsService.markAsRead(markAsReadDto);
    }

    /**
     * Mark all notifications as read for current user
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    @Put('mark-all-read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark all notifications as read for current user' })
    @ApiResponse({
        status: 200,
        description: 'All notifications marked as read successfully',
    })
    async markAllAsRead(@CurrentUser('id') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }

    /**
     * Update a notification
     * Admin/Doctor/Nurse only
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE')
    @Put(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update a notification' })
    @ApiResponse({ status: 200, description: 'Notification updated successfully' })
    @ApiResponse({ status: 404, description: 'Notification not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(updateNotificationSchema))
    async updateNotification(
        @Param('id') id: string,
        @Body() updateNotificationDto: UpdateNotificationDto,
    ) {
        return this.notificationsService.updateNotification(
            id,
            updateNotificationDto,
        );
    }

    /**
     * Delete multiple notifications
     * Admin only
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN')
    @Delete('bulk')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete multiple notifications' })
    @ApiResponse({
        status: 200,
        description: 'Notifications deleted successfully',
    })
    @ApiResponse({ status: 404, description: 'Notifications not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(deleteNotificationSchema))
    async deleteNotifications(
        @Body() deleteNotificationDto: DeleteNotificationDto,
    ) {
        return this.notificationsService.deleteNotifications(
            deleteNotificationDto,
        );
    }

    /**
     * Delete a single notification
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a notification' })
    @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
    @ApiResponse({ status: 404, description: 'Notification not found' })
    async deleteNotification(@Param('id') id: string) {
        return this.notificationsService.deleteNotification(id);
    }
}
