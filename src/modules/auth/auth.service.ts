import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { UserRole, UserStatus } from '@prisma/client';
import { LoginDto, RegisterDto } from './schemas/auth.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) { }

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto) {
    const { email, password, role, ...userData } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role as UserRole,
        status: UserStatus.PENDING_VERIFICATION,
        ...userData,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Create patient or doctor profile based on role
    if (role === 'PATIENT') {
      await this.prisma.patient.create({
        data: {
          userId: user.id,
        },
      });
    } else if (role === 'DOCTOR') {
      // Doctor profile will be completed separately with license info
      await this.prisma.doctor.create({
        data: {
          userId: user.id,
          licenseNumber: `TEMP-${user.id}`, // Temporary, to be updated
          specialization: 'General', // To be updated
          qualifications: [],
          experience: 0,
          consultationFee: 0,
        },
      });
    }

    this.logger.log(`New user registered: ${email} (${role})`);

    // TODO: Send verification email
    // await this.sendVerificationEmail(user.email);

    return {
      message: 'Registration successful. Please check your email for verification.',
      user,
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        patient: {
          select: { id: true },
        },
        doctor: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account status
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account has been suspended');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Check account lockout
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingTime = Math.ceil(
        (user.accountLockedUntil.getTime() - Date.now()) / 1000 / 60,
      );
      throw new UnauthorizedException(
        `Account is locked. Try again in ${remainingTime} minutes.`,
      );
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updateData: any = {
        failedLoginAttempts: failedAttempts,
      };

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        updateData.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        this.logger.warn(`Account locked due to failed login attempts: ${email}`);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts and update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLogin: new Date(),
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    this.logger.log(`User logged in: ${email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        patientId: user.patient?.id,
        doctorId: user.doctor?.id,
      },
      ...tokens,
    };
  }

  /**
   * Logout user
   */
  async logout(userId: string, refreshToken: string) {
    // Revoke refresh token
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        token: refreshToken,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Blacklist access token in Redis
    await this.redisService.set(`blacklist:${userId}`, true, 3600); // 1 hour

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Logout successful' };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(
      tokenRecord.user.id,
      tokenRecord.user.email,
      tokenRecord.user.role,
    );

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date(),
        replacedBy: tokens.refreshToken,
      },
    });

    return tokens;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(userId: string, email: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_ACCESS_TOKEN_EXPIRATION',
            '15m',
          ),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_REFRESH_TOKEN_EXPIRATION',
            '7d',
          ),
        },
      ),
    ]);

    // Store refresh token in database
    const expiresIn = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION');
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: expirationDate,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   */
  private async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Verify email (to be implemented)
   */
  async verifyEmail(token: string) {
    // TODO: Implement email verification logic
    throw new BadRequestException('Email verification not implemented yet');
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await this.verifyPassword(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully' };
  }
}
