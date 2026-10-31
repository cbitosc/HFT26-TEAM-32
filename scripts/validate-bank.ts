import { ALL_BANK_TASKS, validateTask } from '../packages/task-bank/src/index.js';

async function main() {
  console.log(`\n======================================================`);
  console.log(`PROCTOR-FORGE: TASK BANK AUTOMATED VALIDATION GATE`);
  console.log(`======================================================\n`);
  console.log(`Discovered ${ALL_BANK_TASKS.length} pre-authored tasks across 4 domains (Web, Backend, ML, Security)...\n`);

  let passedCount = 0;
  let failedCount = 0;

  for (const task of ALL_BANK_TASKS) {
    process.stdout.write(`Validating [${task.id}] (${task.domain.toUpperCase()} - ${task.tier.toUpperCase()})... `);
    const report = await validateTask(task, { minMutationKillRate: 0.65 });

    if (report.passed) {
      passedCount++;
      const killPercent = report.mutationSummary ? Math.round(report.mutationSummary.killRate * 100) : 100;
      console.log(`\x1b[32m✔ PASSED\x1b[0m (Reference: 100% | Starter: Fails | Mutation: ${killPercent}%)`);
    } else {
      failedCount++;
      console.log(`\x1b[31m✘ FAILED\x1b[0m`);
      for (const d of report.details) {
        console.log(`    - ${d}`);
      }
    }
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`Validation Summary: ${passedCount} Passed, ${failedCount} Failed out of ${ALL_BANK_TASKS.length} tasks.`);
  console.log(`------------------------------------------------------\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal validation runner error:', err);
  process.exit(1);
});

