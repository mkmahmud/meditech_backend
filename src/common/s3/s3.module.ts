import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { UploadController } from './s3.controller';

@Global()
@Module({
  providers: [S3Service],
  exports: [S3Service],
  controllers: [UploadController],
})
export class S3Module { }
