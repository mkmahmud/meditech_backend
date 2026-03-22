import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { NotificationsGateway } from './notifications.gateway';

@Module({
    imports: [
        PrismaModule,
        ScheduleModule.forRoot(),
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, NotificationsGateway],
    exports: [NotificationsService],
})
export class NotificationsModule { }
