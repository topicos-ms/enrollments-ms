import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Enrollment } from './enrollment.entity';
import { CourseSection } from './external/course-section.entity';

@Entity('enrollment_detail')
@Unique(['enrollment_id', 'course_section_id'])
@Index('IDX_enrollment_detail_enrollment', ['enrollment_id'])
@Index('IDX_enrollment_detail_course', ['course_section_id'])
@Index('IDX_enrollment_detail_state', ['course_state'])
@Index('IDX_enrollment_detail_student_term', ['enrollment_id', 'course_section_id'])
export class EnrollmentDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  enrollment_id: string;

  @Column('uuid')
  course_section_id: string;

  @Column('varchar', { length: 20, default: 'Enrolled' })
  course_state: string;

  @Column('numeric', { precision: 5, scale: 2, nullable: true })
  final_grade: number | null;

  @Column('smallint', { default: 1 })
  attempts: number;

  @Column('date', { nullable: true })
  closed_on: Date | null;

  @Column('varchar', { length: 200, nullable: true })
  remark: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Enrollment, (enrollment: Enrollment) => enrollment.enrollment_details, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: Enrollment;

  @ManyToOne(
    () => CourseSection,
    (courseSection: CourseSection) => courseSection.enrollment_details,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'course_section_id' })
  course_section: CourseSection;
}
