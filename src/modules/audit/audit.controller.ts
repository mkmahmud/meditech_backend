import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN')
    @Get('logs')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get audit logs with filters (Admin only)' })
    @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
    async getAuditLogs(
        @Query('userId') userId?: string,
        @Query('resource') resource?: string,
        @Query('action') action?: AuditAction,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('success') success?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.auditService.getAuditLogs({
            userId,
            resource,
            action,
            startDate,
            endDate,
            success,
            limit,
            offset,
        });
    }

    @Get('my-logs')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get current user audit logs' })
    @ApiResponse({ status: 200, description: 'User audit logs retrieved successfully' })
    async getMyLogs(
        @CurrentUser('id') userId: string,
        @Query('limit') limit?: string,
    ) {
        return this.auditService.getUserAuditLogs(userId, Number(limit) || 100);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE')
    @Get('patient/:patientId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get patient PHI access audit logs' })
    @ApiResponse({ status: 200, description: 'Patient audit logs retrieved successfully' })
    async getPatientAuditLogs(
        @Param('patientId') patientId: string,
        @Query('limit') limit?: string,
    ) {
        return this.auditService.getPatientAuditLogs(patientId, Number(limit) || 100);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN')
    @Get('phi-access')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get PHI access audit logs (Admin only)' })
    @ApiResponse({ status: 200, description: 'PHI access logs retrieved successfully' })
    async getPHIAccessLogs(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('limit') limit?: string,
    ) {
        return this.auditService.getPHIAccessLogs(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
            Number(limit) || 1000,
        );
    }
}
