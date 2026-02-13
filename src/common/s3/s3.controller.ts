import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    Body,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';

@Controller('upload')
export class UploadController {
    constructor(private readonly s3Service: S3Service) { }

    /**
     * Handle Single Image Upload
     * Key in FormData: 'file'
     */
    @Post('single')
    @UseInterceptors(FileInterceptor('file'))
    async uploadSingle(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
                    new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
                ],
            }),
        ) file: Express.Multer.File,
        @Body('folder') folder?: string,
    ) {
        const url = await this.s3Service.uploadFile({ file, folder });
        return { url };
    }

    /**
     * Handle Multiple Image Upload
     * Key in FormData: 'files'
     */
    @Post('multiple')
    @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
    async uploadMultiple(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('folder') folder?: string,
    ) {
        const urls = await this.s3Service.uploadMultipleFiles(files, folder);
        return { urls };
    }
}