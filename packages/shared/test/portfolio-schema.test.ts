import { describe, it, expect } from 'vitest';
import { parseAndValidatePortfolio, SAMPLE_PORTFOLIOS } from '../src/schemas/portfolio.js';

describe('Portfolio Validation & Sanitization', () => {
  it('successfully validates all 8 built-in sample portfolios', () => {
    for (const [key, sample] of Object.entries(SAMPLE_PORTFOLIOS)) {
      const jsonStr = JSON.stringify(sample);
      const res = parseAndValidatePortfolio(jsonStr);
      expect(res.success, `Sample portfolio ${key} should validate successfully`).toBe(true);
    }
  });

  it('rejects malformed JSON strings', () => {
    const res = parseAndValidatePortfolio('{ invalid_json');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toContain('Malformed JSON');
    }
  });

  it('rejects payloads exceeding 200KB', () => {
    const massive = {
      ...SAMPLE_PORTFOLIOS.web_fullstack_ts,
      candidate: {
        ...SAMPLE_PORTFOLIOS.web_fullstack_ts.candidate,
        name: 'A'.repeat(250000)
      }
    };
    const res = parseAndValidatePortfolio(JSON.stringify(massive));
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toContain('exceeds maximum allowed size');
    }
  });

  it('defends against prototype pollution payloads', () => {
    const payload = '{"candidate": {}, "__proto__": {"polluted": true}}';
    const res = parseAndValidatePortfolio(payload);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0]).toContain('prototype pollution');
    }
  });

  it('sanitizes embedded HTML tags in strings', () => {
    const dirty = {
      ...SAMPLE_PORTFOLIOS.web_fullstack_ts,
      candidate: {
        ...SAMPLE_PORTFOLIOS.web_fullstack_ts.candidate,
        name: 'Alex <script>alert("xss")</script>Rivera'
      }
    };
    const res = parseAndValidatePortfolio(JSON.stringify(dirty));
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.candidate.name).toBe('Alex alert("xss")Rivera');
      expect(res.data.candidate.name).not.toContain('<script>');
    }
  });
});

