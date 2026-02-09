import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

export interface UploadFileDto {
  // @ts-ignore
  file: Express.Multer.File;
  folder?: string;
  fileName?: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: AWS.S3;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    // @ts-ignore
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');

    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get<string>('AWS_REGION'),
    });

    this.logger.log('S3 Service initialized');
  }

  /**
   * Upload file to S3
   * @param uploadDto - File upload data
   * @returns S3 file URL
   */
  async uploadFile(uploadDto: UploadFileDto): Promise<string> {
    const { file, folder = '', fileName } = uploadDto;

    try {
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = fileName || `${uuidv4()}.${fileExtension}`;
      const key = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private', // Private for HIPAA compliance
        ServerSideEncryption: 'AES256', // Encryption at rest
        Metadata: {
          originalName: file.originalname,
          uploadDate: new Date().toISOString(),
        },
      };

      const result = await this.s3.upload(params).promise();
      this.logger.log(`File uploaded successfully: ${key}`);

      return result.Location;
    } catch (error) {
      this.logger.error('S3 upload failed', error);
      throw new Error('File upload failed');
    }
  }

  /**
   * Upload multiple files
   * @param files - Array of files
   * @param folder - S3 folder
   * @returns Array of S3 URLs
   */
  async uploadMultipleFiles(
    // @ts-ignore
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile({ file, folder }),
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Get signed URL for private file access
   * @param key - S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Signed URL
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn,
      };

      return this.s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      this.logger.error('Failed to generate signed URL', error);
      throw new Error('Failed to generate file access URL');
    }
  }

  /**
   * Delete file from S3
   * @param key - S3 object key
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error('S3 delete failed', error);
      throw new Error('File deletion failed');
    }
  }

  /**
   * Delete multiple files
   * @param keys - Array of S3 object keys
   */
  async deleteMultipleFiles(keys: string[]): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectsRequest = {
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: false,
        },
      };

      await this.s3.deleteObjects(params).promise();
      this.logger.log(`Multiple files deleted: ${keys.length}`);
    } catch (error) {
      this.logger.error('S3 bulk delete failed', error);
      throw new Error('Bulk file deletion failed');
    }
  }

  /**
   * Check if file exists
   * @param key - S3 object key
   * @returns boolean
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucketName,
          Key: key,
        })
        .promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param key - S3 object key
   * @returns File metadata
   */
  async getFileMetadata(key: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      return await this.s3
        .headObject({
          Bucket: this.bucketName,
          Key: key,
        })
        .promise();
    } catch (error) {
      this.logger.error('Failed to get file metadata', error);
      throw new Error('Failed to retrieve file information');
    }
  }

  /**
   * Extract S3 key from URL
   * @param url - S3 file URL
   * @returns S3 object key
   */
  extractKeyFromUrl(url: string): string {
    const urlParts = url.split('/');
    const bucketIndex = urlParts.findIndex((part) =>
      part.includes(this.bucketName),
    );

    if (bucketIndex === -1) {
      throw new Error('Invalid S3 URL');
    }

    return urlParts.slice(bucketIndex + 1).join('/');
  }
}
