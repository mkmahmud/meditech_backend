import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { Public } from '../../common/decorators/auth.decorator';

@ApiTags('Patients')
@ApiBearerAuth('JWT-auth')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) { }

  @Get(':id')
  getPatientProfile(@Param('id') id: string) {
    return this.patientsService.getPatientProfile(id);
  }

  @Public()
  @Get('health-record/:id')
  getHealthRecord(@Param('id') id: string) {
    return this.patientsService.getHealthRecord(id);
  }


}
