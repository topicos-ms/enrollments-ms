import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseSection } from './course-section.entity';

@Entity('schedule')
@Index('IDX_schedule_course_section', ['course_section_id'])
@Index('IDX_schedule_time_overlap', [
  'course_section_id',
  'weekday',
  'time_start',
  'time_end',
])
@Index('IDX_schedule_weekday_time', ['weekday', 'time_start', 'time_end'])
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  course_section_id: string;

  @Column('varchar', { length: 10 })
  weekday: string;

  @Column('time')
  time_start: string;

  @Column('time')
  time_end: string;

  @Column('uuid', { nullable: true })
  classroom_id: string | null;

  @Column('date', { nullable: true })
  date_start: Date | null;

  @Column('date', { nullable: true })
  date_end: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'updated_at',
  })
  updated_at: Date;

  @ManyToOne(() => CourseSection, (courseSection) => courseSection.schedules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'course_section_id' })
  courseSection: CourseSection;
}
