import Docker from 'dockerode';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { runnerConfig } from '../config.js';
import { RunnerRequest, RunnerResponse, TestResultItem } from '@proctor-forge/shared';
import { createHarnessConfig, generatePythonHarnessScript, generateNodeHarnessScript, extractHarnessResult } from './execution-harness.js';
import { validateCodeSafety } from './security-guards.js';

let docker: Docker | null = null;
let isDockerAvailable = false;

try {
  docker = new Docker();
  docker.ping((err) => {
    if (!err) {
      isDockerAvailable = true;
    }
  });
} catch {
  docker = null;
  isDockerAvailable = false;
}

export async function executeInSandbox(req: RunnerRequest): Promise<RunnerResponse> {
  const startTime = Date.now();

  // 1. Static security check
  const safety = validateCodeSafety(req.language, [...req.files, ...req.testFiles]);
  if (!safety.safe) {
    return {
      runId: req.runId,
      taskId: req.taskId,
      success: false,
      exitCode: 1,
      executionTimeMs: Date.now() - startTime,
      stdout: '',
      stderr: safety.violations.join('\n'),
      testResults: [],
      securityViolations: safety.violations,
      error: 'Security guardrail violation: forbidden API or unsafe filesystem pattern'
    };
  }

  const harnessConfig = createHarnessConfig();

  // 2. Create isolated scratch temporary directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `proctor-run-${req.runId}-`));

  try {
    // Write user files
    for (const f of req.files) {
      const fullPath = path.join(tempDir, f.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, f.content, 'utf-8');
    }

    // Write test files
    for (const f of req.testFiles) {
      const fullPath = path.join(tempDir, f.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, f.content, 'utf-8');
    }

    // Write harness runner script
    let harnessFile = '';
    let execCommand: string[] = [];

    if (req.language === 'python') {
      harnessFile = path.join(tempDir, '__proctor_harness__.py');
      await fs.writeFile(harnessFile, generatePythonHarnessScript(harnessConfig), 'utf-8');
      execCommand = ['python3', '__proctor_harness__.py'];
    } else {
      harnessFile = path.join(tempDir, '__proctor_harness__.js');
      await fs.writeFile(harnessFile, generateNodeHarnessScript(harnessConfig), 'utf-8');
      execCommand = ['node', '__proctor_harness__.js'];
    }

    // 3. Execution (Docker or child_process sandbox fallback)
    let stdoutRaw = '';
    let stderrRaw = '';
    let exitCode = 0;

    if (isDockerAvailable && docker) {
      const imageName = req.language === 'python'
        ? runnerConfig.DOCKER_PYTHON_IMAGE
        : runnerConfig.DOCKER_NODE_IMAGE;

      const hostConfig: Docker.HostConfig = {
        NetworkMode: 'none',
        Memory: runnerConfig.RUNNER_MEMORY_LIMIT_MB * 1024 * 1024,
        MemorySwap: runnerConfig.RUNNER_MEMORY_LIMIT_MB * 1024 * 1024,
        CpuQuota: runnerConfig.RUNNER_CPU_QUOTA_MICROS,
        CpuPeriod: 100000,
        PidsLimit: runnerConfig.RUNNER_PIDS_LIMIT,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        Binds: [`${tempDir}:/sandbox:ro`],
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' }
      };

      if (runnerConfig.RUNNER_USE_GVISOR) {
        hostConfig.Runtime = 'runsc';
      }

      const container = await docker.createContainer({
        Image: imageName,
        Cmd: execCommand,
        WorkingDir: '/sandbox',
        User: '1001:1001',
        HostConfig: hostConfig
      });

      try {
        await container.start();

        const waitPromise = container.wait();
        const timeoutPromise = new Promise<{ StatusCode: number }>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), req.timeoutMs)
        );

        const status = await Promise.race([waitPromise, timeoutPromise]);
        exitCode = status.StatusCode;

        const logs = await container.logs({ stdout: true, stderr: true });
        stdoutRaw = logs.toString();
      } catch (err: any) {
        if (err.message === 'TIMEOUT') {
          await container.kill().catch(() => {});
          return {
            runId: req.runId,
            taskId: req.taskId,
            success: false,
            exitCode: 124,
            executionTimeMs: req.timeoutMs,
            stdout: '',
            stderr: 'Execution timed out (Wall-clock limit exceeded)',
            testResults: [],
            securityViolations: [],
            error: 'TIMEOUT'
          };
        }
        throw err;
      } finally {
        await container.remove({ force: true }).catch(() => {});
      }
    } else {
      // Local process execution fallback with timeout containment
      const procBinary = req.language === 'python' ? 'python' : 'node';
      const child = spawn(procBinary, [harnessFile], {
        cwd: tempDir,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PYTHONUNBUFFERED: '1',
          PYTHONDONTWRITEBYTECODE: '1'
        }
      });

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL');
      }, req.timeoutMs);

      child.stdout.on('data', (d) => {
        if (stdoutRaw.length < runnerConfig.MAX_OUTPUT_BYTES) stdoutRaw += d.toString();
      });
      child.stderr.on('data', (d) => {
        if (stderrRaw.length < runnerConfig.MAX_OUTPUT_BYTES) stderrRaw += d.toString();
      });

      exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code) => {
          clearTimeout(timeoutHandle);
          resolve(code ?? 1);
        });
        child.on('error', () => {
          clearTimeout(timeoutHandle);
          resolve(1);
        });
      });
    }

    const durationMs = Date.now() - startTime;
    const harnessResult = extractHarnessResult(stdoutRaw, harnessConfig);

    let testResults: TestResultItem[] = [];
    if (harnessResult.parsed) {
      testResults = harnessResult.testResults;
    } else if (exitCode !== 0) {
      testResults = [{
        id: 'execution_failure',
        name: 'Process Execution',
        passed: false,
        durationMs,
        category: 'correctness',
        weight: 1,
        error: stderrRaw || 'Execution crashed or exited with non-zero status'
      }];
    }

    return {
      runId: req.runId,
      taskId: req.taskId,
      success: testResults.length > 0 && testResults.every((t) => t.passed),
      exitCode,
      executionTimeMs: durationMs,
      stdout: harnessResult.stdoutCleaned || stdoutRaw.slice(0, 5000),
      stderr: stderrRaw.slice(0, 5000),
      testResults,
      securityViolations: []
    };
  } finally {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

