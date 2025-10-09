import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { envs } from './config/envs';
import { EventPublisherInterceptor } from './common/events/event-publisher.interceptor';

async function bootstrap() {
  const logger = new Logger('EnrollmentsMS');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: envs.natsServers,
      },
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(app.get(EventPublisherInterceptor));

  await app.listen();
  logger.log(`Enrollments microservice listening on port ${envs.port}`);
}
bootstrap();
