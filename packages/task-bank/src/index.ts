import { TaskSpec } from '@proctor-forge/shared';
import { WEB_TASKS } from './tasks/web/tasks.js';
import { BACKEND_TASKS } from './tasks/backend/tasks.js';
import { ML_TASKS } from './tasks/ml/tasks.js';
import { SECURITY_TASKS } from './tasks/security/tasks.js';

export * from './mutations/mutators.js';
export * from './bank-validator.js';
export * from './tasks/web/tasks.js';
export * from './tasks/backend/tasks.js';
export * from './tasks/ml/tasks.js';
export * from './tasks/security/tasks.js';

export const ALL_BANK_TASKS: TaskSpec[] = [
  ...WEB_TASKS,
  ...BACKEND_TASKS,
  ...ML_TASKS,
  ...SECURITY_TASKS
];

export function findBankTasks(domain: string, tier: string): TaskSpec[] {
  return ALL_BANK_TASKS.filter(
    (t) => t.domain.toLowerCase() === domain.toLowerCase() && t.tier.toLowerCase() === tier.toLowerCase()
  );
}

export function getTaskById(taskId: string): TaskSpec | undefined {
  return ALL_BANK_TASKS.find((t) => t.id === taskId);
}

