import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnrollmentsModule } from './enrollments/enrollments.module';

@Module({
  imports: [EnrollmentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
