# MediTech Backend - Setup Guide

## Step-by-Step Installation

### Step 1: Prerequisites Check

Before starting, ensure you have:

```bash
# Check Node.js version (should be >= 18)
node --version

# Check npm version
npm --version

# Check if PostgreSQL is installed
psql --version

# Check if Redis is installed
redis-cli --version
```

### Step 2: Install Dependencies

```bash
npm install
```

If you encounter any errors, try:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Step 3: Database Setup

#### Option A: Local PostgreSQL

1. Create database:
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE meditech_db;

# Exit psql
\q
```

2. Update `.env`:
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/meditech_db?schema=public"
```

#### Option B: Docker PostgreSQL

```bash
docker run --name meditech-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=meditech_db \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### Step 4: Redis Setup

#### Option A: Local Redis

```bash
# Start Redis
redis-server
```

#### Option B: Docker Redis

```bash
docker run --name meditech-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

### Step 5: AWS S3 Setup

1. Create an AWS account (if you don't have one)
2. Create an S3 bucket:
   - Go to AWS Console > S3
   - Click "Create bucket"
   - Name: `meditech-files-[your-name]`
   - Region: Choose your region
   - Block all public access: ✅ (HIPAA requirement)
   - Enable bucket versioning: ✅
   - Enable default encryption: ✅ (Use SSE-S3 or SSE-KMS)

3. Create IAM user for S3 access:
   - Go to IAM > Users > Add user
   - User name: `meditech-s3-user`
   - Access type: Programmatic access
   - Attach policy: `AmazonS3FullAccess` (or create custom policy)
   - Save Access Key ID and Secret Access Key

4. Update `.env`:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=meditech-files-[your-name]
```

### Step 6: Environment Variables

1. Copy example file:
```bash
cp .env.example .env
```

2. Generate secure secrets:
```bash
# Generate JWT secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate encryption key (must be exactly 32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

3. Update `.env` with generated values:
```env
JWT_SECRET=<generated-64-char-hex>
JWT_REFRESH_SECRET=<generated-64-char-hex>
ENCRYPTION_KEY=<generated-32-char-hex>
```

### Step 7: Initialize Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Create database tables
npm run prisma:migrate

# (Optional) View database in Prisma Studio
npm run prisma:studio
```

### Step 8: Create Logs Directory

```bash
mkdir -p logs
```

### Step 9: Start the Application

```bash
# Development mode
npm run start:dev

# The app should now be running at:
# API: http://localhost:3000/api/v1
# Swagger Docs: http://localhost:3000/api/docs
```

### Step 10: Test the API

1. Open Swagger UI: `http://localhost:3000/api/docs`

2. Register a test user:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "firstName": "Test",
    "lastName": "User",
    "role": "PATIENT"
  }'
```

3. Login:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

4. Use the returned `accessToken` for authenticated requests.

## Docker Setup (Easier Alternative)

If you prefer Docker, simply run:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Access the application
# API: http://localhost:3000/api/v1
# Swagger: http://localhost:3000/api/docs
# Prisma Studio: http://localhost:5555
```

To run migrations in Docker:
```bash
docker-compose exec app npm run prisma:migrate
```

## Troubleshooting

### Database Connection Error

**Error**: `Can't reach database server`

**Solution**:
- Check if PostgreSQL is running: `psql -U postgres`
- Verify DATABASE_URL in `.env`
- Check firewall settings

### Prisma Migration Error

**Error**: `Migration failed`

**Solution**:
```bash
# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Or manually drop and recreate
psql -U postgres -c "DROP DATABASE meditech_db;"
psql -U postgres -c "CREATE DATABASE meditech_db;"
npm run prisma:migrate
```

### Redis Connection Error

**Error**: `Redis connection refused`

**Solution**:
- Check if Redis is running: `redis-cli ping` (should return PONG)
- Verify REDIS_HOST and REDIS_PORT in `.env`
- Start Redis: `redis-server` or `docker-compose up redis`

### S3 Upload Error

**Error**: `Access Denied` or `InvalidAccessKeyId`

**Solution**:
- Verify AWS credentials in `.env`
- Check IAM user has S3 permissions
- Verify bucket name is correct
- Ensure bucket exists and is in the correct region

### Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

## Next Steps

1. **Configure Email Service**
   - Set up SMTP credentials in `.env`
   - Uncomment email sending code in auth service

2. **Set Up CI/CD**
   - Configure GitHub Actions or Jenkins
   - Set up automated testing
   - Deploy to cloud provider (AWS, GCP, Azure)

3. **Add Monitoring**
   - Set up application monitoring (New Relic, DataDog)
   - Configure log aggregation (ELK stack, CloudWatch)
   - Set up alerts for critical errors

4. **Implement Additional Features**
   - Video conferencing integration
   - Payment gateway integration
   - AI symptom checker
   - Push notifications

5. **Security Hardening**
   - Enable two-factor authentication
   - Implement rate limiting per user
   - Add IP whitelisting for admin routes
   - Set up Web Application Firewall (WAF)

## Useful Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start in debug mode

# Build
npm run build             # Build for production
npm run start:prod        # Run production build

# Database
npm run prisma:studio     # Open Prisma Studio
npm run prisma:generate   # Generate Prisma Client
npm run prisma:migrate    # Run migrations

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format code with Prettier

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Run tests with coverage
npm run test:e2e          # Run end-to-end tests

# Docker
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose logs -f    # View logs
```

## Production Deployment Checklist

- [ ] Change all default secrets
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS/SSL
- [ ] Configure database backups
- [ ] Set up monitoring and logging
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable helmet security headers
- [ ] Review and test all API endpoints
- [ ] Set up disaster recovery plan
- [ ] Configure auto-scaling
- [ ] Set up health checks
- [ ] Enable database connection pooling
- [ ] Configure CDN for static assets
- [ ] Set up database replicas
- [ ] Implement caching strategy

## Getting Help

- 📖 [NestJS Documentation](https://docs.nestjs.com)
- 📖 [Prisma Documentation](https://www.prisma.io/docs)
- 📖 [PostgreSQL Documentation](https://www.postgresql.org/docs)
- 💬 Create an issue in the repository
- 📧 Contact the development team

---

**Happy Coding! 🚀**
