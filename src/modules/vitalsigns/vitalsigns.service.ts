import {
    Injectable,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VitalsignsService {
    private readonly logger = new Logger(VitalsignsService.name);

    constructor(
        private prisma: PrismaService,
    ) { }


    // Create a new vital sign record for a patient
    async createVitalSign(patientId: string, vitalSignData: any) {
        this.logger.debug(`Creating vital sign for patient ${patientId} with data: ${JSON.stringify(vitalSignData)}`);
        const newVitalSign = await this.prisma.vitalSign.create({
            data: {
                patientId,
                ...vitalSignData,
            },
        });
        this.logger.debug(`Created vital sign with ID: ${newVitalSign.id}`);
        return newVitalSign;
    }


}
