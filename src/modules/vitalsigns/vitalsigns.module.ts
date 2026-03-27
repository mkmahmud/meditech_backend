import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VitalsignsController } from './vitalsigns.controller';
import { VitalsignsService } from './vitalsigns.service';

@Module({
    imports: [PrismaModule],
    controllers: [VitalsignsController],
    providers: [VitalsignsService],
    exports: [VitalsignsService],
})
export class VitalsignsModule { }
