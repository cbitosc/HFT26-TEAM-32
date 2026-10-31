import { randomBytes } from 'crypto';
import { TestResultItem } from '@proctor-forge/shared';

export interface HarnessConfig {
  nonce: string;
  beginMarker: string;
  endMarker: string;
}

export function createHarnessConfig(): HarnessConfig {
  const nonce = randomBytes(16).toString('hex');
  return {
    nonce,
    beginMarker: `---BEGIN-PROCTOR-RESULT-${nonce}---`,
    endMarker: `---END-PROCTOR-RESULT-${nonce}---`
  };
}

export function generatePythonHarnessScript(config: HarnessConfig): string {
  return `
import sys
import json
import time
import traceback
import unittest

def run_tests():
    loader = unittest.TestLoader()
    suite = loader.discover('.', pattern='test_*.py')
    
    results = []
    start_total = time.time()
    
    for test_group in suite:
        for test in test_group:
            test_id = str(test)
            test_name = test._testMethodName
            test_start = time.time()
            res = unittest.TestResult()
            test.run(res)
            duration_ms = round((time.time() - test_start) * 1000, 2)
            
            passed = res.wasSuccessful()
            err_msg = None
            if not passed:
                if res.failures:
                    err_msg = res.failures[0][1]
                elif res.errors:
                    err_msg = res.errors[0][1]
            
            category = "correctness"
            if "edge" in test_name.lower():
                category = "edge"
            elif "perf" in test_name.lower():
                category = "performance"
            elif "sec" in test_name.lower():
                category = "security"
                
            results.append({
                "id": test_name,
                "name": test_name,
                "passed": passed,
                "durationMs": duration_ms,
                "category": category,
                "weight": 1.0,
                "error": err_msg
            })
            
    total_time_ms = round((time.time() - start_total) * 1000, 2)
    payload = {
        "success": all(r["passed"] for r in results) if results else False,
        "testResults": results,
        "totalTimeMs": total_time_ms
    }
    
    sys.stdout.flush()
    print("${config.beginMarker}")
    print(json.dumps(payload))
    print("${config.endMarker}")
    sys.stdout.flush()

if __name__ == '__main__':
    run_tests()
`;
}

export function generateNodeHarnessScript(config: HarnessConfig): string {
  return `
const fs = require('fs');
const path = require('path');

async function runNodeTests() {
  const startTime = Date.now();
  const results = [];
  
  const files = fs.readdirSync('.').filter(f => f.endsWith('.test.js') || f.endsWith('.spec.js'));
  
  for (const file of files) {
    try {
      const suite = require(path.resolve('.', file));
      if (typeof suite.runSuite === 'function') {
        const suiteRes = await suite.runSuite();
        results.push(...suiteRes);
      }
    } catch (err) {
      results.push({
        id: file,
        name: file,
        passed: false,
        durationMs: 0,
        category: 'correctness',
        weight: 1.0,
        error: err.stack || err.message
      });
    }
  }
  
  const payload = {
    success: results.length > 0 && results.every(r => r.passed),
    testResults: results,
    totalTimeMs: Date.now() - startTime
  };
  
  console.log('${config.beginMarker}');
  console.log(JSON.stringify(payload));
  console.log('${config.endMarker}');
}

runNodeTests().catch(err => {
  console.error('Harness fatal error:', err);
  process.exit(1);
});
`;
}

export function extractHarnessResult(rawOutput: string, config: HarnessConfig): {
  parsed: boolean;
  testResults: TestResultItem[];
  totalTimeMs?: number;
  stdoutCleaned: string;
} {
  const beginIdx = rawOutput.indexOf(config.beginMarker);
  const endIdx = rawOutput.indexOf(config.endMarker);

  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
    return {
      parsed: false,
      testResults: [],
      stdoutCleaned: rawOutput.slice(0, 5000)
    };
  }

  const jsonStr = rawOutput.substring(beginIdx + config.beginMarker.length, endIdx).trim();
  const stdoutCleaned = (rawOutput.substring(0, beginIdx) + rawOutput.substring(endIdx + config.endMarker.length)).trim();

  try {
    const data = JSON.parse(jsonStr);
    return {
      parsed: true,
      testResults: data.testResults || [],
      totalTimeMs: data.totalTimeMs,
      stdoutCleaned: stdoutCleaned.slice(0, 5000)
    };
  } catch {
    return {
      parsed: false,
      testResults: [],
      stdoutCleaned: stdoutCleaned.slice(0, 5000)
    };
  }
}

