import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Student } from './external/student.entity';
import { Term } from './external/term.entity';
import { EnrollmentDetail } from './enrollment-detail.entity';

@Entity('enrollment')
@Index('IDX_enrollment_student', ['student_id'])
@Index('IDX_enrollment_term', ['term_id'])
@Index('IDX_enrollment_state', ['state'])
@Index('IDX_enrollment_student_term', ['student_id', 'term_id'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  student_id: string;

  @Column('uuid')
  term_id: string;

  @Column('date', { default: () => 'CURRENT_DATE' })
  enrolled_on: Date;

  @Column('varchar', { length: 20, default: 'Active' })
  state: string;

  @Column('varchar', { length: 20, nullable: true })
  origin: string | null;

  @Column('varchar', { length: 200, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Term)
  @JoinColumn({ name: 'term_id' })
  term: Term;

  @OneToMany(() => EnrollmentDetail, (detail) => detail.enrollment, {
    cascade: true,
  })
  enrollment_details: EnrollmentDetail[];
}
