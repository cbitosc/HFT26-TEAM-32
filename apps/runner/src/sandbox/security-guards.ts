import { TaskFile } from '@proctor-forge/shared';

const BANNED_PYTHON_IMPORTS = [
  /\bimport\s+socket\b/,
  /\bfrom\s+socket\b/,
  /\bimport\s+urllib\b/,
  /\bfrom\s+urllib\b/,
  /\bimport\s+requests\b/,
  /\bimport\s+http\b/,
  /\bimport\s+ftplib\b/,
  /\bimport\s+subprocess\b/,
  /\bimport\s+os\.system\b/,
  /\bgetattr\(.*os.*\)/
];

const BANNED_NODE_IMPORTS = [
  /\brequire\s*\(\s*['"]net['"]\s*\)/,
  /\brequire\s*\(\s*['"]http['"]\s*\)/,
  /\brequire\s*\(\s*['"]https['"]\s*\)/,
  /\brequire\s*\(\s*['"]child_process['"]\s*\)/,
  /\bimport\s+.*\s+from\s+['"]net['"]/,
  /\bimport\s+.*\s+from\s+['"]http['"]/,
  /\bimport\s+.*\s+from\s+['"]child_process['"]/,
  /\bfetch\s*\(/
];

const BANNED_FS_PATTERNS = [
  /\.\.\/\.\.\//,
  /\/etc\/passwd/,
  /\/var\/run/,
  /\/proc\//
];

export function validateCodeSafety(language: string, files: TaskFile[]): { safe: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const file of files) {
    if (file.content.length > 200 * 1024) {
      violations.push(`File ${file.path} exceeds max 200KB limit`);
    }

    for (const pat of BANNED_FS_PATTERNS) {
      if (pat.test(file.content) || pat.test(file.path)) {
        violations.push(`Suspicious filesystem traversal pattern in ${file.path}`);
      }
    }

    if (language === 'python') {
      for (const pattern of BANNED_PYTHON_IMPORTS) {
        if (pattern.test(file.content)) {
          violations.push(`Forbidden import or system execution detected in ${file.path}: ${pattern}`);
        }
      }
    } else if (language === 'javascript' || language === 'typescript') {
      for (const pattern of BANNED_NODE_IMPORTS) {
        if (pattern.test(file.content)) {
          violations.push(`Forbidden network or process API detected in ${file.path}: ${pattern}`);
        }
      }
    }
  }

  return {
    safe: violations.length === 0,
    violations
  };
}

