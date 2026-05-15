import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OverviewService } from './overview.service';

@ApiTags('Overview')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) { }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user overview by role' })
  @ApiResponse({ status: 200, description: 'Overview retrieved succ essfully' })
  async getOverview(@CurrentUser() user: any) {
    const overview = await this.overviewService.getOverview(user);

    return {
      message: 'Overview retrieved successfully',
      overview,
    };
  }
}
