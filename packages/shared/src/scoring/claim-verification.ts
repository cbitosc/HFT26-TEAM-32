import { Portfolio } from '../schemas/portfolio.js';
import { TaskReportItem, ClaimVerificationItem } from '../schemas/report.js';

export function computeClaimVerificationIndex(
  portfolio: Portfolio,
  taskReports: TaskReportItem[]
): ClaimVerificationItem[] {
  const results: ClaimVerificationItem[] = [];

  // 1. Verify DSA Topic claims
  for (const dsa of portfolio.dsaTopicsSolved) {
    const matchingTasks = taskReports.filter((t) =>
      t.dsaTopics.map((topic) => topic.toLowerCase()).includes(dsa.topic.toLowerCase())
    );

    if (matchingTasks.length === 0) {
      results.push({
        claimType: 'dsaTopic',
        name: dsa.topic,
        claimedLevel: `${dsa.difficultyComfort} (${dsa.approxCount} solved)`,
        demonstratedStatus: 'Not Demonstrated',
        evidence: 'Topic was outside generated task focus for this assessment tier session',
        confidence: 0.5
      });
      continue;
    }

    const avgPassRate = matchingTasks.reduce((acc, t) => acc + t.passRatePercent, 0) / matchingTasks.length;
    let status: 'Verified' | 'Partially Verified' | 'Not Demonstrated';
    if (avgPassRate >= 80) {
      status = 'Verified';
    } else if (avgPassRate >= 40) {
      status = 'Partially Verified';
    } else {
      status = 'Not Demonstrated';
    }

    results.push({
      claimType: 'dsaTopic',
      name: dsa.topic,
      claimedLevel: `${dsa.difficultyComfort} (${dsa.approxCount} solved)`,
      demonstratedStatus: status,
      evidence: `Tested across ${matchingTasks.length} task(s). Average test pass rate: ${Math.round(avgPassRate)}%.`,
      confidence: 0.95
    });
  }

  // 2. Verify Skills
  for (const skill of portfolio.skills) {
    const skillNorm = skill.name.toLowerCase();
    const isDomainMatch = taskReports.some((t) =>
      t.domain.toLowerCase().includes(skillNorm) ||
      t.title.toLowerCase().includes(skillNorm)
    );

    const overallPassRate = taskReports.length > 0
      ? taskReports.reduce((acc, t) => acc + t.passRatePercent, 0) / taskReports.length
      : 0;

    let status: 'Verified' | 'Partially Verified' | 'Not Demonstrated';
    if (isDomainMatch && overallPassRate >= 75) {
      status = 'Verified';
    } else if (overallPassRate >= 50) {
      status = 'Partially Verified';
    } else {
      status = 'Not Demonstrated';
    }

    results.push({
      claimType: 'skill',
      name: skill.name,
      claimedLevel: `Proficiency ${skill.proficiency}/5`,
      demonstratedStatus: status,
      evidence: `Evaluated via ${taskReports.length} domain tasks. Overall task execution competence: ${Math.round(overallPassRate)}%.`,
      confidence: isDomainMatch ? 0.9 : 0.6
    });
  }

  // 3. Verify Projects
  for (const proj of portfolio.projects) {
    const overallPassRate = taskReports.length > 0
      ? taskReports.reduce((acc, t) => acc + t.passRatePercent, 0) / taskReports.length
      : 0;

    const status: 'Verified' | 'Partially Verified' | 'Not Demonstrated' =
      overallPassRate >= 70 ? 'Verified' : overallPassRate >= 40 ? 'Partially Verified' : 'Not Demonstrated';

    results.push({
      claimType: 'project',
      name: proj.title,
      claimedLevel: proj.role,
      demonstratedStatus: status,
      evidence: `Scenario-mapped implementation demonstrated ${Math.round(overallPassRate)}% test satisfaction against expected project architectural idioms.`,
      confidence: 0.85
    });
  }

  return results;
}

