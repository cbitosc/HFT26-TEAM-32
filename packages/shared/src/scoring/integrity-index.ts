import { TelemetryEvent, IntegrityRiskIndex, IntegritySignal } from '../schemas/telemetry.js';
import { INTEGRITY_THRESHOLDS } from '../constants/defaults.js';

export function computeIntegrityRiskIndex(events: TelemetryEvent[], isHashChainValid: boolean): IntegrityRiskIndex {
  const anomalies: string[] = [];

  // 1. Tab blur / focus loss
  const blurEvents = events.filter((e) => e.type === 'tab_blur');
  let totalBlurDurationMs = 0;
  for (const blur of blurEvents) {
    if (blur.payload?.durationMs && typeof blur.payload.durationMs === 'number') {
      totalBlurDurationMs += blur.payload.durationMs;
    }
  }
  const blurCount = blurEvents.length;
  let tabBlurScore = 0;
  if (blurCount > 10 || totalBlurDurationMs > 60000) {
    tabBlurScore = Math.min(100, (blurCount * 5) + Math.floor(totalBlurDurationMs / 10000) * 10);
    anomalies.push(`Frequent focus loss: ${blurCount} tab switches (${Math.round(totalBlurDurationMs / 1000)}s total away)`);
  }

  // 2. Fullscreen exits
  const fullscreenExits = events.filter((e) => e.type === 'fullscreen_exit').length;
  let fullscreenScore = 0;
  if (fullscreenExits > 2) {
    fullscreenScore = Math.min(100, fullscreenExits * 20);
    anomalies.push(`Candidate exited fullscreen ${fullscreenExits} times`);
  }

  // 3. Devtools detection
  const devtoolsEvents = events.filter((e) => e.type === 'devtools_open').length;
  let devtoolsScore = devtoolsEvents > 0 ? 90 : 0;
  if (devtoolsEvents > 0) {
    anomalies.push(`Browser DevTools opened ${devtoolsEvents} times during examination`);
  }

  // 4. Large paste / external code injection
  const pasteEvents = events.filter((e) => e.type === 'paste');
  let externalPastesCount = 0;
  let largestPasteChars = 0;
  for (const p of pasteEvents) {
    const chars = Number(p.payload?.charCount || 0);
    if (chars > largestPasteChars) largestPasteChars = chars;
    if (p.payload?.source === 'external' || chars > 150) {
      externalPastesCount += 1;
    }
  }
  let pasteScore = 0;
  if (externalPastesCount > 0 || largestPasteChars > 250) {
    pasteScore = Math.min(100, externalPastesCount * 25 + (largestPasteChars > 300 ? 40 : 0));
    anomalies.push(`External paste detected: ${externalPastesCount} events (largest: ${largestPasteChars} chars)`);
  }

  // 5. Teleport code (large code diff without keystroke cadence)
  const teleportEvents = events.filter((e) => e.type === 'teleport_code').length;
  let teleportScore = teleportEvents > 0 ? Math.min(100, teleportEvents * 50) : 0;
  if (teleportEvents > 0) {
    anomalies.push(`Teleport code: ${teleportEvents} code additions appeared with zero registered keystrokes`);
  }

  // 6. Extraction / Prompt injection attempts against the AI assistant
  const extractionEvents = events.filter((e) => e.type === 'extraction_attempt').length;
  let extractionScore = extractionEvents > 0 ? Math.min(100, extractionEvents * 45) : 0;
  if (extractionEvents > 0) {
    anomalies.push(`Assistant security breach: ${extractionEvents} prompt injection / jailbreak attempts detected`);
  }

  // 7. Non-human typing cadence
  const cadenceEvents = events.filter((e) => e.type === 'keystroke_cadence');
  const nonHumanCadence = cadenceEvents.filter((c) => c.payload?.isHumanLike === false).length;
  if (nonHumanCadence > 2) {
    anomalies.push(`Non-human typing cadence flagged: synthetic bursts detected`);
  }

  // 8. Hash chain tampering penalty
  let chainTamperScore = !isHashChainValid ? 100 : 0;
  if (!isHashChainValid) {
    anomalies.push(`CRITICAL: Audit log cryptographic hash chain validation failed — possible log tampering!`);
  }

  const signals: IntegritySignal[] = [
    {
      name: 'Tab Focus Integrity',
      weight: 0.15,
      rawScore: tabBlurScore,
      weightedContribution: Math.round(tabBlurScore * 0.15 * 10) / 10,
      description: 'Absence from IDE tab / switching to other applications',
      evidenceCount: blurCount,
      evidenceDetails: blurEvents.map((b) => `Left tab for ${b.payload?.durationMs || 0}ms`)
    },
    {
      name: 'Fullscreen Compliance',
      weight: 0.10,
      rawScore: fullscreenScore,
      weightedContribution: Math.round(fullscreenScore * 0.10 * 10) / 10,
      description: 'Retention of fullscreen exam view',
      evidenceCount: fullscreenExits,
      evidenceDetails: [`Exited fullscreen ${fullscreenExits} times`]
    },
    {
      name: 'DevTools & Inspection',
      weight: 0.15,
      rawScore: devtoolsScore,
      weightedContribution: Math.round(devtoolsScore * 0.15 * 10) / 10,
      description: 'Developer console / element inspector invocation',
      evidenceCount: devtoolsEvents,
      evidenceDetails: devtoolsEvents > 0 ? ['DevTools activity detected'] : []
    },
    {
      name: 'Clipboard / External Pastes',
      weight: 0.20,
      rawScore: pasteScore,
      weightedContribution: Math.round(pasteScore * 0.20 * 10) / 10,
      description: 'Pasting external code or massive text chunks',
      evidenceCount: externalPastesCount,
      evidenceDetails: [`${externalPastesCount} suspicious pastes`, `Max paste: ${largestPasteChars} chars`]
    },
    {
      name: 'Code Teleportation',
      weight: 0.15,
      rawScore: teleportScore,
      weightedContribution: Math.round(teleportScore * 0.15 * 10) / 10,
      description: 'Large code additions without typing events',
      evidenceCount: teleportEvents,
      evidenceDetails: [`${teleportEvents} teleport occurrences`]
    },
    {
      name: 'AI Extraction & Jailbreaks',
      weight: 0.15,
      rawScore: extractionScore,
      weightedContribution: Math.round(extractionScore * 0.15 * 10) / 10,
      description: 'Attempts to exfiltrate solutions or bypass guardrails',
      evidenceCount: extractionEvents,
      evidenceDetails: [`${extractionEvents} prompt injection events`]
    },
    {
      name: 'Audit Chain Cryptographic Integrity',
      weight: 0.10,
      rawScore: chainTamperScore,
      weightedContribution: Math.round(chainTamperScore * 0.10 * 10) / 10,
      description: 'Verification of immutable SHA-256 event chain',
      evidenceCount: isHashChainValid ? 0 : 1,
      evidenceDetails: isHashChainValid ? ['Hash chain intact'] : ['Hash chain broken']
    }
  ];

  const totalRawWeighted = signals.reduce((acc, s) => acc + s.weightedContribution, 0);
  const totalScore = Math.min(100, Math.round(totalRawWeighted));

  let riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  if (totalScore <= INTEGRITY_THRESHOLDS.lowRiskMax) {
    riskBand = 'LOW';
  } else if (totalScore <= INTEGRITY_THRESHOLDS.mediumRiskMax) {
    riskBand = 'MEDIUM';
  } else {
    riskBand = 'HIGH';
  }

  return {
    totalScore,
    riskBand,
    signals,
    hashChainValid: isHashChainValid,
    totalEventsAnalyzed: events.length,
    keyAnomalies: anomalies
  };
}

