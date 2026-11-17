export type TaskFixation = 'flexible' | 'hard';
export type TaskStatus = 'active' | 'done' | 'cancelled';
export type BlockStatus = 'planned' | 'done' | 'missed';
export type BlockSource = 'planner' | 'manual' | 'rest';

export interface TaskType {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy: number;
  readonly is_one_off: boolean;
  readonly is_rest: boolean;
  readonly archived_at: string | null;
}
