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
                    // Reduced to 4MB for Vercel compatibility (4.5MB hard limit)
                    new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 4 }), // 4MB
                    new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp|pdf)' }),
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

    /**
     * Get Presigned URL for Direct S3 Upload (Recommended for Vercel)
     * This bypasses the 4.5MB Vercel limit
     * POST /upload/presigned-url
     * Body: { fileName: 'image.jpg', folder: 'profiles', contentType: 'image/jpeg' }
     */
    @Post('presigned-url')
    async getPresignedUrl(
        @Body('fileName') fileName: string,
        @Body('folder') folder?: string,
        @Body('contentType') contentType?: string,
    ) {
        if (!fileName) {
            throw new Error('fileName is required');
        }

        const result = await this.s3Service.getPresignedUploadUrl(
            fileName,
            folder,
            contentType,
        );

        return {
            uploadUrl: result.url,
            key: result.key,
            message: 'Use PUT request to upload file directly to this URL',
            expiresIn: 300, // 5 minutes
        };
    }
}