# MediTech Healthcare Platform - Backend

A **HIPAA-compliant** healthcare platform backend built with NestJS, Prisma, PostgreSQL, and Redis. This boilerplate provides a solid foundation for building a comprehensive medical management system with role-based access control, audit logging, and data encryption.

## 🏥 Features

### Core Features
- ✅ **Smart Appointment Engine** - Real-time scheduling with automated reminders
- ✅ **Digital Prescription Suite** - Secure prescription management with drug interaction alerts
- ✅ **Patient Health Vault** - Centralized medical history and allergy tracking
- ✅ **Virtual Diagnostics** - Lab results and vital signs tracking
- ✅ **Telehealth Integration** - Ready for video conferencing integration
- ✅ **Family Profiles** - Manage multiple family members from one account

### Security & Compliance
- 🔒 **HIPAA Compliant** - Comprehensive audit logging for all PHI access
- 🔐 **JWT Authentication** - Secure token-based authentication
- 🛡️ **Role-Based Access Control (RBAC)** - Granular permissions system
- 🔑 **Data Encryption** - AES-256 encryption for sensitive data at rest
- 📝 **Audit Logging** - Track all data access and modifications
- 🚫 **Rate Limiting** - Protection against brute force attacks

### Technical Stack
- **Framework**: NestJS (Node.js/TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Storage**: AWS S3 (for medical documents)
- **Validation**: Zod schemas
- **Documentation**: Swagger/OpenAPI
- **Authentication**: JWT with refresh tokens

## 📋 Prerequisites

- Node.js >= 18.x
- PostgreSQL >= 14
- Redis >= 6
- AWS Account (for S3 storage)
- npm or yarn

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd meditech-backend

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment variables
cp .env.example .env

# Edit .env file with your configurations
nano .env
```

**Important Environment Variables:**

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/meditech_db?schema=public"

# JWT Secrets (Change these!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Encryption (32 characters for AES-256)
ENCRYPTION_KEY=your-32-character-encryption-key-change-me

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_NAME=meditech-files
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### 4. Run the Application

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at: `http://localhost:3000/api/v1`

Swagger documentation: `http://localhost:3000/api/docs`

## 🐳 Docker Setup

```bash
# Start all services (PostgreSQL, Redis, App)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## 📁 Project Structure

```
meditech-backend/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── common/
│   │   ├── decorators/        # Custom decorators
│   │   ├── encryption/        # Encryption service
│   │   ├── pipes/             # Validation pipes
│   │   ├── prisma/            # Prisma service
│   │   ├── redis/             # Redis service
│   │   └── s3/                # S3 file storage service
│   ├── config/                # Configuration files
│   ├── modules/
│   │   ├── auth/              # Authentication & authorization
│   │   ├── users/             # User management
│   │   ├── patients/          # Patient management
│   │   ├── doctors/           # Doctor management
│   │   ├── appointments/      # Appointment scheduling
│   │   ├── prescriptions/     # Prescription management
│   │   ├── lab-results/       # Lab results
│   │   ├── insurance/         # Insurance verification
│   │   ├── payments/          # Payment processing
│   │   ├── notifications/     # Notification system
│   │   └── audit/             # Audit logging (HIPAA)
│   ├── app.module.ts          # Main application module
│   └── main.ts                # Application entry point
├── .env.example               # Environment variables template
├── docker-compose.yml         # Docker configuration
├── Dockerfile                 # Docker image
├── nest-cli.json              # NestJS CLI configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## 🔐 User Roles

The system supports the following roles:

- **SUPER_ADMIN** - Full system access
- **ADMIN** - Hospital/clinic administration
- **DOCTOR** - Medical practitioners
- **NURSE** - Nursing staff
- **PATIENT** - Patients
- **RECEPTIONIST** - Front desk staff
- **PHARMACIST** - Pharmacy staff
- **LAB_TECHNICIAN** - Laboratory technicians

## 🔑 API Authentication

### 1. Register a new user

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "doctor@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "DOCTOR"
}
```

### 2. Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "doctor@example.com",
  "password": "SecurePass123!"
}
```

Response:
```json
{
  "user": { ... },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### 3. Use Access Token

```bash
GET /api/v1/users/me
Authorization: Bearer eyJhbGc...
```

### 4. Refresh Token

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

## 📊 Database Models

### Core Models
- **User** - System users (all roles)
- **Patient** - Patient-specific data
- **Doctor** - Doctor-specific data
- **Appointment** - Appointment scheduling
- **Prescription** - Digital prescriptions
- **MedicalHistory** - Patient medical history
- **Allergy** - Patient allergies
- **LabResult** - Laboratory test results
- **Insurance** - Insurance information
- **Payment** - Payment transactions
- **VitalSign** - Patient vital signs
- **AuditLog** - HIPAA compliance logging

## 🔒 HIPAA Compliance Features

### 1. Audit Logging
All access to Protected Health Information (PHI) is logged:

```typescript
// Automatically logged by the audit interceptor
await auditService.logDataAccess(
  userId,
  'Patient',
  patientId,
  ipAddress,
  true, // PHI accessed
  patientId
);
```

### 2. Data Encryption
Sensitive data is encrypted at rest:

```typescript
// Encrypt sensitive fields
const encrypted = encryptionService.encrypt('sensitive data');

// Decrypt when needed
const decrypted = encryptionService.decrypt(encrypted);
```

### 3. Role-Based Access
Protect routes with role guards:

```typescript
@Roles(UserRole.DOCTOR, UserRole.ADMIN)
@Get('patients/:id')
async getPatient(@Param('id') id: string) {
  // Only doctors and admins can access
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Adding New Features

### 1. Generate a new module

```bash
nest g module modules/feature-name
nest g controller modules/feature-name
nest g service modules/feature-name
```

### 2. Update Prisma schema

```bash
# Edit prisma/schema.prisma
# Then run:
npm run prisma:migrate
```

### 3. Create Zod validation schemas

```typescript
// src/modules/feature-name/schemas/feature.schema.ts
import { z } from 'zod';

export const createFeatureSchema = z.object({
  name: z.string().min(1),
  // ... other fields
});

export type CreateFeatureDto = z.infer<typeof createFeatureSchema>;
```

## 🔧 Configuration

### Redis Configuration
Used for caching and session management:

```typescript
// Cache user data
await redisService.set('user:123', userData, 3600); // TTL: 1 hour

// Get cached data
const user = await redisService.get('user:123');
```

### S3 File Storage
Upload medical documents securely:

```typescript
// Upload file
const url = await s3Service.uploadFile({
  file: uploadedFile,
  folder: 'medical-records',
});

// Get signed URL for private file
const signedUrl = await s3Service.getSignedUrl(key, 3600);
```

## 🚨 Security Best Practices

1. **Never commit `.env` file** - Use `.env.example` as a template
2. **Use strong JWT secrets** - At least 32 characters
3. **Enable 2FA** - Implement two-factor authentication for sensitive roles
4. **Rotate encryption keys** - Periodically update encryption keys
5. **Monitor audit logs** - Regularly review PHI access logs
6. **Update dependencies** - Keep all packages up to date
7. **Use HTTPS** - Always use SSL/TLS in production
8. **Rate limiting** - Already configured, adjust as needed

## 📈 Performance Optimization

- **Redis caching** - Cache frequently accessed data
- **Database indexing** - Prisma schema includes optimized indexes
- **Connection pooling** - Configured in Prisma
- **Compression** - Response compression enabled
- **Query optimization** - Use Prisma's selective field queries

## 🔄 Future Integrations (Prepared)

The boilerplate is ready for:

- 📧 Email notifications (SMTP configured)
- 📱 SMS notifications (Twilio placeholder)
- 🎥 Video conferencing (Agora/Twilio placeholders)
- 💳 Payment gateways (Stripe placeholder)
- 🤖 AI/ML services (OpenAI placeholder)
- 🏪 E-Pharmacy integration (Generic integration layer)

## 📝 License

This project is proprietary and confidential.

## 🤝 Support

For issues and questions:
- Create an issue in the repository
- Contact the development team

---

## ⚠️ Important Notes

### Before Production:

1. Change all default secrets in `.env`
2. Set up proper AWS S3 bucket with encryption
3. Configure SSL/TLS certificates
4. Set up database backups
5. Configure monitoring and alerting
6. Implement proper logging aggregation
7. Set up CI/CD pipeline
8. Review and adjust rate limiting
9. Implement email verification
10. Set up disaster recovery plan

### HIPAA Compliance Checklist:

- ✅ Audit logging enabled
- ✅ Data encryption at rest
- ✅ Secure authentication (JWT)
- ✅ Role-based access control
- ✅ PHI access tracking
- ⏳ Business Associate Agreements (BAA)
- ⏳ Employee training
- ⏳ Incident response plan
- ⏳ Regular security audits

---

**Built with ❤️ for Healthcare**
