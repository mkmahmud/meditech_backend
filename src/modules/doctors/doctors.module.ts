import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { doctorsService } from './doctors.services';

@Module({
    controllers: [DoctorsController],
    providers: [doctorsService],
    exports: [doctorsService],
})
export class DoctorsModule { }
