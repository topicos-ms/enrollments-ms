import { ChildEntity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Enrollment } from '../enrollment.entity';
import { Grade } from './grade.entity';
import { StudyPlan } from './study-plan.entity';

@ChildEntity()
export class Student extends User {
  @Column('varchar', { length: 30, unique: true })
  code: string;

  @Column('uuid')
  study_plan_id: string;

  @ManyToOne(() => StudyPlan)
  @JoinColumn({ name: 'study_plan_id' })
  study_plan: StudyPlan;

  @Column('date')
  enrolled_at: Date;

  @Column('date', { nullable: true })
  birth_date: Date;

  @Column('char', { length: 1, nullable: true })
  sex: string;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments: Enrollment[];

  @OneToMany(() => Grade, (grade) => grade.student)
  grades: Grade[];
}
