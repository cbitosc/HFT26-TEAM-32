export interface Mutant {
  id: string;
  originalFilePath: string;
  mutatedContent: string;
  mutationType: string;
  description: string;
}

export function generateMutants(filePath: string, originalCode: string, maxMutants = 10): Mutant[] {
  const mutants: Mutant[] = [];
  let mutantCount = 0;

  // 1. Relational operator mutations
  const relationalSwaps: [RegExp, string, string][] = [
    [/\s+==\s+/g, ' != ', 'equality to inequality'],
    [/\s+!=\s+/g, ' == ', 'inequality to equality'],
    [/\s+===\s+/g, ' !== ', 'strict equality to strict inequality'],
    [/\s+!==\s+/g, ' === ', 'strict inequality to strict equality'],
    [/\s+>\s+/g, ' <= ', 'greater-than to less-than-or-equal'],
    [/\s+<\s+/g, ' >= ', 'less-than to greater-than-or-equal'],
    [/\s+>=\s+/g, ' < ', 'greater-than-or-equal to less-than'],
    [/\s+<=\s+/g, ' > ', 'less-than-or-equal to greater-than']
  ];

  for (const [regex, replacement, desc] of relationalSwaps) {
    if (regex.test(originalCode) && mutantCount < maxMutants) {
      regex.lastIndex = 0;
      const mutated = originalCode.replace(regex, replacement);
      if (mutated !== originalCode) {
        mutantCount++;
        mutants.push({
          id: `mutant_rel_${mutantCount}`,
          originalFilePath: filePath,
          mutatedContent: mutated,
          mutationType: 'RELATIONAL_INVERSION',
          description: `Mutated ${desc}`
        });
      }
    }
  }

  // 2. Arithmetic operator mutations
  const arithmeticSwaps: [RegExp, string, string][] = [
    [/\s+\+\s+/g, ' - ', 'addition to subtraction'],
    [/\s+-\s+/g, ' + ', 'subtraction to addition'],
    [/\s+\*\s+/g, ' / ', 'multiplication to division']
  ];

  for (const [regex, replacement, desc] of arithmeticSwaps) {
    if (regex.test(originalCode) && mutantCount < maxMutants) {
      regex.lastIndex = 0;
      const mutated = originalCode.replace(regex, replacement);
      if (mutated !== originalCode) {
        mutantCount++;
        mutants.push({
          id: `mutant_arith_${mutantCount}`,
          originalFilePath: filePath,
          mutatedContent: mutated,
          mutationType: 'ARITHMETIC_FLIP',
          description: `Mutated ${desc}`
        });
      }
    }
  }

  // 3. Off-by-one / boundary mutations
  const boundarySwaps: [RegExp, string, string][] = [
    [/\+\s*1\b/g, '+ 0', 'increment dropped to + 0'],
    [/-\s*1\b/g, '- 0', 'decrement dropped to - 0'],
    [/\.length\s*-\s*1/g, '.length', 'array length - 1 altered to length'],
    [/len\(([^)]+)\)\s*-\s*1/g, 'len($1)', 'len(x) - 1 altered to len(x)']
  ];

  for (const [regex, replacement, desc] of boundarySwaps) {
    if (regex.test(originalCode) && mutantCount < maxMutants) {
      regex.lastIndex = 0;
      const mutated = originalCode.replace(regex, replacement);
      if (mutated !== originalCode) {
        mutantCount++;
        mutants.push({
          id: `mutant_bound_${mutantCount}`,
          originalFilePath: filePath,
          mutatedContent: mutated,
          mutationType: 'BOUNDARY_OFF_BY_ONE',
          description: `Mutated ${desc}`
        });
      }
    }
  }

  // 4. Return value mutations
  const returnSwaps: [RegExp, string, string][] = [
    [/return\s+True\b/g, 'return False', 'return True mutated to return False'],
    [/return\s+False\b/g, 'return True', 'return False mutated to return True'],
    [/return\s+true\b/g, 'return false', 'return true mutated to return false'],
    [/return\s+false\b/g, 'return true', 'return false mutated to return true'],
    [/return\s+0\b/g, 'return -1', 'return 0 mutated to return -1'],
    [/return\s+\[\]/g, 'return None', 'return empty array mutated to return None/null']
  ];

  for (const [regex, replacement, desc] of returnSwaps) {
    if (regex.test(originalCode) && mutantCount < maxMutants) {
      regex.lastIndex = 0;
      const mutated = originalCode.replace(regex, replacement);
      if (mutated !== originalCode) {
        mutantCount++;
        mutants.push({
          id: `mutant_ret_${mutantCount}`,
          originalFilePath: filePath,
          mutatedContent: mutated,
          mutationType: 'RETURN_VALUE_TAMPER',
          description: `Mutated ${desc}`
        });
      }
    }
  }

  // 5. Logical operator inversion
  const logicalSwaps: [RegExp, string, string][] = [
    [/\s+&&\s+/g, ' || ', '&& flipped to ||'],
    [/\s+\|\|\s+/g, ' && ', '|| flipped to &&'],
    [/\s+and\s+/g, ' or ', 'and flipped to or'],
    [/\s+or\s+/g, ' and ', 'or flipped to and']
  ];

  for (const [regex, replacement, desc] of logicalSwaps) {
    if (regex.test(originalCode) && mutantCount < maxMutants) {
      regex.lastIndex = 0;
      const mutated = originalCode.replace(regex, replacement);
      if (mutated !== originalCode) {
        mutantCount++;
        mutants.push({
          id: `mutant_logic_${mutantCount}`,
          originalFilePath: filePath,
          mutatedContent: mutated,
          mutationType: 'LOGICAL_INVERSION',
          description: `Mutated ${desc}`
        });
      }
    }
  }

  return mutants;
}

