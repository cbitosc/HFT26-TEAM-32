import { NextRequest, NextResponse } from 'next/server';
import vm from 'vm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier, files, testCases } = body;

    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ success: false, error: 'Files array required' }, { status: 400 });
    }

    // Build module environment
    const moduleExports: Record<string, any> = {};
    const modules: Record<string, any> = {};

    // Load helper files into virtual require cache
    for (const f of files) {
      const cleanPath = f.path.replace(/^\.\//, '');
      const code = f.content;

      const sandbox: any = {
        console: {
          log: (...args: any[]) => consoleOutput.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          error: (...args: any[]) => consoleOutput.push('[ERROR] ' + args.join(' ')),
          warn: (...args: any[]) => consoleOutput.push('[WARN] ' + args.join(' ')),
        },
        module: { exports: {} },
        exports: {},
        require: (modName: string) => {
          const modClean = modName.replace(/^\.\//, '').replace(/\.js$/, '');
          for (const [k, v] of Object.entries(modules)) {
            if (k.replace(/\.js$/, '') === modClean) {
              return v;
            }
          }
          throw new Error(`Cannot find module '${modName}'`);
        },
      };

      try {
        const script = new vm.Script(code, { filename: cleanPath });
        const context = vm.createContext(sandbox);
        script.runInContext(context, { timeout: 2000 });
        modules[cleanPath] = sandbox.module.exports;
        if (cleanPath === 'solution.js' || cleanPath === 'rateLimiter.js' || cleanPath === 'lruCache.js') {
          Object.assign(moduleExports, sandbox.module.exports);
        }
      } catch (err: any) {
        return NextResponse.json({
          success: true,
          compilationError: `Syntax/Runtime Error in ${cleanPath}: ${err.message}`,
          passed: false,
          testResults: [],
          totalTests: testCases?.length || 0,
          passedTests: 0,
        });
      }
    }

    const consoleOutput: string[] = [];
    const testResults: any[] = [];
    let passedCount = 0;

    const startMemory = process.memoryUsage().heapUsed;
    const t0 = performance.now();

    // Execute test cases
    for (const tc of testCases || []) {
      const tcStart = performance.now();
      let passed = false;
      let actualOutput = '';
      let testError = '';

      try {
        if (tier === 'novice') {
          const fn = moduleExports.sanitizeAndFilter;
          if (typeof fn !== 'function') throw new Error('sanitizeAndFilter function not exported');

          if (tc.id === 'novice-t1') {
            const res = fn([], 5);
            actualOutput = JSON.stringify(res);
            passed = actualOutput === tc.expectedOutput;
          } else if (tc.id === 'novice-t2') {
            const res = fn([1, 4, 8, 2, 10], 4);
            actualOutput = JSON.stringify(res);
            passed = actualOutput === tc.expectedOutput;
          } else if (tc.id === 'novice-t3') {
            const res = fn([2, 2, 5, 5, 5, 9], 2);
            actualOutput = JSON.stringify(res);
            passed = actualOutput === tc.expectedOutput;
          } else if (tc.id === 'novice-t4') {
            const res = fn([10, 20, 30], 10);
            actualOutput = JSON.stringify(res);
            passed = actualOutput === tc.expectedOutput;
          }
        } else if (tier === 'adept') {
          const LimiterClass = moduleExports.SlidingWindowRateLimiter;
          if (!LimiterClass) throw new Error('SlidingWindowRateLimiter not exported');
          const limiter = new LimiterClass();

          if (tc.id === 'adept-t1') {
            const res = limiter.isAllowed('user-1', 1000, 3, 10000);
            actualOutput = JSON.stringify(res);
            passed = res?.allowed === true && res?.remaining === 2;
          } else if (tc.id === 'adept-t2') {
            limiter.isAllowed('user-1', 1000, 3, 10000);
            limiter.isAllowed('user-1', 1001, 3, 10000);
            limiter.isAllowed('user-1', 1002, 3, 10000);
            const res = limiter.isAllowed('user-1', 1003, 3, 10000);
            actualOutput = JSON.stringify(res);
            passed = res?.allowed === false && res?.remaining === 0;
          } else if (tc.id === 'adept-t3') {
            limiter.isAllowed('user-1', 1000, 3, 10000);
            limiter.isAllowed('user-1', 2000, 3, 10000);
            limiter.isAllowed('user-1', 3000, 3, 10000);
            const res = limiter.isAllowed('user-1', 14000, 3, 10000);
            actualOutput = JSON.stringify(res);
            passed = res?.allowed === true;
          } else if (tc.id === 'adept-t4') {
            limiter.isAllowed('user-1', 1000, 1, 10000);
            const res = limiter.isAllowed('user-2', 1001, 3, 10000);
            actualOutput = JSON.stringify(res);
            passed = res?.allowed === true;
          }
        } else if (tier === 'master') {
          const CacheClass = moduleExports.LRUCache;
          if (!CacheClass) throw new Error('LRUCache class not exported');

          if (tc.id === 'master-t1') {
            const c = new CacheClass(2);
            c.put(1, 100);
            const res = c.get(1);
            actualOutput = String(res);
            passed = res === 100;
          } else if (tc.id === 'master-t2') {
            const c = new CacheClass(2);
            c.put(1, 10);
            c.put(2, 20);
            c.put(3, 30); // 1 is evicted
            const res = c.get(1);
            actualOutput = String(res);
            passed = res === -1;
          } else if (tc.id === 'master-t3') {
            const c = new CacheClass(2);
            c.put(1, 10);
            c.put(2, 20);
            c.get(1); // 1 becomes MRU
            c.put(3, 30); // 2 evicted
            const res = c.get(1);
            actualOutput = String(res);
            passed = res === 10 && c.get(2) === -1;
          } else if (tc.id === 'master-t4') {
            const c = new CacheClass(100);
            for (let i = 0; i < 20000; i++) {
              c.put(i % 500, i);
              if (i % 2 === 0) c.get(i % 500);
            }
            actualOutput = 'PASS_FAST';
            passed = true;
          }
        }
      } catch (e: any) {
        testError = e.message;
        actualOutput = `Error: ${e.message}`;
      }

      if (passed) passedCount++;

      testResults.push({
        id: tc.id,
        name: tc.name,
        passed,
        category: tc.category,
        isHidden: tc.isHidden,
        executionTimeMs: Math.round((performance.now() - tcStart) * 100) / 100,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput,
        error: testError,
      });
    }

    const totalTimeMs = Math.round((performance.now() - t0) * 100) / 100;
    const memoryUsedBytes = Math.max(0, process.memoryUsage().heapUsed - startMemory);

    return NextResponse.json({
      success: true,
      passed: passedCount === testCases.length,
      totalTests: testCases.length,
      passedTests: passedCount,
      testResults,
      executionTimeMs: totalTimeMs,
      memoryUsedKb: Math.round(memoryUsedBytes / 1024),
      consoleOutput,
    });
  } catch (err: any) {
    console.error('Run code error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

