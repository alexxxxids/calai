// The planner's public entry point: import from '@/domain/scheduler'.
// Everything else in this folder is internal to the planner.
export { planSchedule } from '@/domain/scheduler/plan-schedule';
export { normalizeSessionMinutes } from '@/domain/scheduler/session';
export { workToPlan, type WorkToPlanInput } from '@/domain/scheduler/work-to-plan';
export type {
  BusyItem,
  PlannedBlock,
  PlannerInput,
  PlannerResult,
  PlannerTask,
  UnscheduledWork,
} from '@/domain/types';
