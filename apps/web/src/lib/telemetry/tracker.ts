import { TelemetryEventType } from '@proctor-forge/shared';

export class ClientTelemetryTracker {
  private assessmentId: string;
  private taskId?: string;
  private blurStartTime: number | null = null;
  private keystrokeTimestamps: number[] = [];
  private lastKnownContentLength = 0;
  private isDestroyed = false;

  constructor(assessmentId: string, taskId?: string) {
    this.assessmentId = assessmentId;
    this.taskId = taskId;
  }

  setTaskId(taskId: string) {
    this.taskId = taskId;
  }

  private async emitEvent(type: TelemetryEventType, payload: Record<string, any> = {}) {
    if (this.isDestroyed || typeof window === 'undefined') return;

    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: this.assessmentId,
          taskId: this.taskId,
          type,
          payload
        })
      });
    } catch (e) {
      // Telemetry failure should not break editor
      console.warn('[Telemetry] Transmission failure:', e);
    }
  }

  startTracking() {
    if (typeof window === 'undefined') return;

    // 1. Fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.emitEvent('fullscreen_exit');
      } else {
        this.emitEvent('fullscreen_enter');
      }
    });

    // 2. Tab visibility & blur
    window.addEventListener('blur', () => {
      this.blurStartTime = Date.now();
      this.emitEvent('tab_blur');
    });

    window.addEventListener('focus', () => {
      let durationMs = 0;
      if (this.blurStartTime) {
        durationMs = Date.now() - this.blurStartTime;
        this.blurStartTime = null;
      }
      this.emitEvent('tab_focus', { durationMs });
    });

    // 3. DevTools open heuristic (detect window dimensions vs screen)
    window.addEventListener('resize', () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        this.emitEvent('devtools_open');
      }
      this.emitEvent('window_resize', { innerWidth: window.innerWidth, innerHeight: window.innerHeight });
    });

    // 4. Clipboard events
    document.addEventListener('paste', (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') || '';
      const charCount = text.length;
      this.emitEvent('paste', {
        charCount,
        source: charCount > 150 ? 'external' : 'internal'
      });
    });

    document.addEventListener('copy', () => {
      this.emitEvent('copy');
    });

    // 5. Keystroke dynamics cadence monitoring
    window.addEventListener('keydown', () => {
      const now = Date.now();
      this.keystrokeTimestamps.push(now);

      // Analyze every 20 keypresses
      if (this.keystrokeTimestamps.length >= 20) {
        const intervals: number[] = [];
        for (let i = 1; i < this.keystrokeTimestamps.length; i++) {
          intervals.push(this.keystrokeTimestamps[i]! - this.keystrokeTimestamps[i - 1]!);
        }
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + (b - avg) ** 2, 0) / intervals.length;
        // Human typing has variance > 500ms^2; synthetic script bursts have near-zero variance
        const isHumanLike = variance > 300 && avg > 40;

        this.emitEvent('keystroke_cadence', {
          averageIntervalMs: Math.round(avg),
          variance: Math.round(variance),
          isHumanLike
        });

        this.keystrokeTimestamps = [];
      }
    });
  }

  // Detect sudden large code insertions without keystrokes ("Teleport code")
  checkContentLengthChange(newLength: number) {
    const diff = newLength - this.lastKnownContentLength;
    if (diff > 180 && this.keystrokeTimestamps.length < 5) {
      this.emitEvent('teleport_code', { diffSize: diff });
    }
    this.lastKnownContentLength = newLength;
  }

  destroy() {
    this.isDestroyed = true;
  }
}

