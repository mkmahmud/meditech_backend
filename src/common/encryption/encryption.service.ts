import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private configService: ConfigService) {
    // @ts-ignore
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!this.encryptionKey || this.encryptionKey.length !== 32) {
      this.logger.warn('⚠️  ENCRYPTION_KEY must be 32 characters for AES-256. Using default (NOT FOR PRODUCTION)');
    }
  }

  /**
   * Encrypt sensitive data (PHI - Protected Health Information)
   * @param data - Plain text data
   * @returns Encrypted string
   */
  encrypt(data: string): string {
    if (!data) return data;

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey),
        iv,
      );

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return IV + encrypted data (IV needed for decryption)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData - Encrypted string
   * @returns Decrypted plain text
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) return encryptedData;

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey),
        iv,
      );

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Hash sensitive data (one-way, for comparison)
   * @param data - Plain text data
   * @returns Hashed string
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypt object fields
   * @param obj - Object with fields to encrypt
   * @param fields - Array of field names to encrypt
   * @returns Object with encrypted fields
   */
  encryptFields<T extends Record<string, any>>(
    obj: T,
    fields: (keyof T)[],
  ): T {
    const encrypted = { ...obj };

    fields.forEach((field) => {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encrypt(encrypted[field] as string) as T[keyof T];
      }
    });

    return encrypted;
  }

  /**
   * Decrypt object fields
   * @param obj - Object with encrypted fields
   * @param fields - Array of field names to decrypt
   * @returns Object with decrypted fields
   */
  decryptFields<T extends Record<string, any>>(
    obj: T,
    fields: (keyof T)[],
  ): T {
    const decrypted = { ...obj };

    fields.forEach((field) => {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = this.decrypt(decrypted[field] as string) as T[keyof T];
        } catch (error) {
          this.logger.warn(`Failed to decrypt field: ${String(field)}`);
        }
      }
    });

    return decrypted;
  }

  /**
   * Mask PHI data for logging/display
   * @param data - Sensitive data
   * @param visibleChars - Number of characters to show at start/end
   * @returns Masked string
   */
  maskPHI(data: string, visibleChars: number = 2): string {
    if (!data || data.length <= visibleChars * 2) {
      return '***';
    }

    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const masked = '*'.repeat(data.length - visibleChars * 2);

    return `${start}${masked}${end}`;
  }

  /**
   * Generate secure random token
   * @param length - Token length
   * @returns Random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt JSON data
   * @param data - Object to encrypt
   * @returns Encrypted JSON string
   */
  encryptJSON(data: any): string {
    const jsonString = JSON.stringify(data);
    return this.encrypt(jsonString);
  }

  /**
   * Decrypt JSON data
   * @param encryptedData - Encrypted JSON string
   * @returns Decrypted object
   */
  decryptJSON<T = any>(encryptedData: string): T {
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }
}
