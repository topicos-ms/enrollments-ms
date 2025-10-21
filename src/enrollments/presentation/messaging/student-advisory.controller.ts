import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CourseRecommendationService } from '../../use-cases/recommendation';
import type { RecommendedCoursesResponse } from '../../use-cases/recommendation/course-recommendation.service';

interface RecommendedCoursesPayload {
  studentId?: string;
  studentCode?: string;
}

@Controller()
export class StudentAdvisoryController {
  constructor(
    private readonly courseRecommendationService: CourseRecommendationService,
  ) {}

  @MessagePattern('enrollments.students.recommendedCourses')
  async getRecommendedCourses(
    @Payload() payload: RecommendedCoursesPayload,
  ): Promise<RecommendedCoursesResponse> {
    return this.courseRecommendationService.getRecommendedCoursesForStudent(
      payload ?? {},
    );
  }
}
