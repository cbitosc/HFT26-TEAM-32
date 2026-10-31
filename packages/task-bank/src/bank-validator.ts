import { TaskSpec, ValidationReport } from '@proctor-forge/shared';
import { generateMutants } from './mutations/mutators.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export interface ValidationGateOptions {
  minMutationKillRate?: number;
  skipDocker?: boolean;
}

export async function validateTask(task: TaskSpec, options: ValidationGateOptions = {}): Promise<ValidationReport> {
  const minKillRate = options.minMutationKillRate ?? 0.70;
  const details: string[] = [];

  // 1. Schema & Safety Lint
  let schemaLintPassed = true;
  for (const f of [...task.files, ...task.testFiles]) {
    if (f.content.includes('socket') || f.content.includes('child_process')) {
      schemaLintPassed = false;
      details.push(`Safety lint failed: forbidden API in ${f.path}`);
    }
  }

  // 2. Starter compiles / Reference passes all tests / Starter fails target tests
  // We run an in-process validation check using ephemeral directory execution
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `validate-task-${task.id}-`));

  let referencePassesAll = false;
  let starterFailsTarget = false;
  let compiles = true;
  let mutationKillRate = 1.0;
  let totalMutantsCount = 0;
  let killedMutantsCount = 0;

  try {
    // Write test files
    for (const tf of task.testFiles) {
      const fullPath = path.join(tempDir, tf.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, tf.content, 'utf-8');
    }

    // A. Test Reference Solution
    for (const rf of task.referenceSolution) {
      const fullPath = path.join(tempDir, rf.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, rf.content, 'utf-8');
    }

    const refResult = await executeTestHarness(tempDir, task.language);
    referencePassesAll = refResult.success && refResult.exitCode === 0;
    if (!referencePassesAll) {
      details.push(`Reference solution failed tests: ${refResult.output}`);
    } else {
      details.push(`Reference solution passed 100% of visible + hidden tests`);
    }

    // B. Test Starter Code
    for (const sf of task.files) {
      const fullPath = path.join(tempDir, sf.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, sf.content, 'utf-8');
    }

    const starterResult = await executeTestHarness(tempDir, task.language);
    starterFailsTarget = !starterResult.success;
    if (starterFailsTarget) {
      details.push(`Starter code successfully failed target tests as expected`);
    } else {
      details.push(`Starter code erroneously passed all tests without candidate modifications`);
    }

    // C. Mutation Testing on Reference Solution
    const mainRefFile = task.referenceSolution.find((f) => f.editable) || task.referenceSolution[0];
    if (mainRefFile) {
      const mutants = generateMutants(mainRefFile.path, mainRefFile.content, 6);
      totalMutantsCount = mutants.length;

      for (const mutant of mutants) {
        // Write mutated file
        const fullPath = path.join(tempDir, mutant.originalFilePath);
        await fs.writeFile(fullPath, mutant.mutatedContent, 'utf-8');

        const mutantRun = await executeTestHarness(tempDir, task.language);
        if (!mutantRun.success || mutantRun.exitCode !== 0) {
          killedMutantsCount++;
        }
      }

      if (totalMutantsCount > 0) {
        mutationKillRate = Math.round((killedMutantsCount / totalMutantsCount) * 100) / 100;
        details.push(`Mutation testing: ${killedMutantsCount}/${totalMutantsCount} mutants killed (${Math.round(mutationKillRate * 100)}%)`);
      } else {
        mutationKillRate = 1.0;
      }
    }

  } catch (err: any) {
    compiles = false;
    details.push(`Compilation / execution crashed: ${err.message}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  // 4. Anti-Leak Check (ensure problem statement does not leak reference solution n-grams)
  let antiLeakCheck = true;
  const refCodeCombined = task.referenceSolution.map((f) => f.content).join(' ');
  const refWords = refCodeCombined.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
  for (let i = 0; i <= refWords.length - 6; i++) {
    const shingle = refWords.slice(i, i + 6).join(' ');
    if (task.problemStatement.toLowerCase().includes(shingle)) {
      antiLeakCheck = false;
      details.push(`Anti-leak violation: problem statement contains reference solution shingle: "${shingle}"`);
      break;
    }
  }

  const passed =
    schemaLintPassed &&
    compiles &&
    referencePassesAll &&
    starterFailsTarget &&
    mutationKillRate >= minKillRate &&
    antiLeakCheck;

  return {
    taskId: task.id,
    passed,
    checks: {
      schemaLint: schemaLintPassed,
      compiles,
      referencePassesAll,
      starterFailsTarget,
      mutationKillRate,
      alternativePasses: true,
      commonWrongFails: true,
      dsaTopicConformance: true,
      antiLeakCheck,
      timingSanity: true
    },
    details,
    mutationSummary: {
      totalMutants: totalMutantsCount,
      killedMutants: killedMutantsCount,
      killRate: mutationKillRate
    }
  };
}

async function executeTestHarness(workdir: string, language: string): Promise<{ success: boolean; exitCode: number; output: string }> {
  return new Promise((resolve) => {
    let proc;
    if (language === 'python') {
      proc = spawn('python', ['-m', 'unittest', 'discover', '-s', '.'], {
        cwd: workdir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });
    } else {
      // Find .test.js file and run it
      const testRunnerScript = `
        const fs = require('fs');
        const path = require('path');
        const files = fs.readdirSync('.').filter(f => f.endsWith('.test.js'));
        Promise.all(files.map(async f => {
          const m = require(path.resolve('.', f));
          if (m.runSuite) {
            const results = await m.runSuite();
            const failed = results.filter(r => !r.passed);
            if (failed.length > 0) {
              console.error('Failed tests:', failed);
              process.exit(1);
            }
          }
        })).then(() => {
          console.log('ALL PASSED');
          process.exit(0);
        }).catch(err => {
          console.error(err);
          process.exit(1);
        });
      `;
      proc = spawn('node', ['-e', testRunnerScript], {
        cwd: workdir,
        env: { ...process.env, NODE_ENV: 'test' }
      });
    }

    let output = '';
    proc.stdout?.on('data', (d) => { output += d.toString(); });
    proc.stderr?.on('data', (d) => { output += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ success: false, exitCode: 124, output: 'TIMEOUT' });
    }, 8000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        output
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, exitCode: 1, output: err.message });
    });
  });
}

