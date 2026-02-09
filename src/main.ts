import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // Compression
  app.use(compression());

  // Cookie parser
  app.use(cookieParser());

  // CORS Configuration
  app.enableCors({
    origin: configService.get('CORS_ORIGIN'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix
  const apiPrefix = configService.get('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe with Zod support
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Custom error formatting
        return errors;
      },
    }),
  );

  // Swagger Documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('MediTech Healthcare API')
      .setDescription('HIPAA-Compliant Healthcare Platform API Documentation')
      .setVersion('1.0')
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Patients', 'Patient management')
      .addTag('Doctors', 'Doctor management')
      .addTag('Appointments', 'Appointment scheduling and management')
      .addTag('Prescriptions', 'Digital prescription management')
      .addTag('Lab Results', 'Laboratory test results')
      .addTag('Payments', 'Billing and payment processing')
      .addTag('Insurance', 'Insurance verification and management')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    console.log(`📚 Swagger documentation available at: http://localhost:${configService.get('PORT')}/api/docs`);
  }

  const port = configService.get('PORT', 5000);
  await app.listen(port);

  console.log(`🚀 MediTech Backend is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`🔒 HIPAA Compliance Mode: ${configService.get('ENABLE_AUDIT_LOGGING') ? 'ENABLED' : 'DISABLED'}`);
}

bootstrap();
