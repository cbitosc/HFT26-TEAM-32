# PROCTOR-FORGE: Deterministic Scoring System

Proctor-Forge enforces **100% deterministic grading**. An LLM is strictly prohibited from judging code correctness or assigning points.

---

## 1. Overall Score Composition (80 / 20 Rule)

$$\text{Final Score} = \text{Correctness Portion} + \text{AI Usage Efficiency Portion} + \text{Time Bonus}$$

- **Correctness Portion (Max 80 Points):** Computed from automated unit test assertions in isolated sandboxes across the 3 assessment tiers.
- **AI Usage Efficiency (Max 20 Points):** Computed from interaction logs, testing rhythm, and independence.
- **Time Bonus (Max 5 Points):** Awarded for early completion if and only if test pass rate exceeds 80%.
- **Final Score Cap:** Bound strictly to $[0, 100]$.

---

## 2. Correctness Portion Formula

$$\text{Tier Weights: } W_{\text{novice}} = 0.20, \quad W_{\text{adept}} = 0.35, \quad W_{\text{master}} = 0.45$$

$$\text{Task Score} = \sum_{\text{cat}} \left( M_{\text{cat}} \times \frac{\sum \text{weight of passed tests in category}}{\sum \text{weight of total tests in category}} \right)$$

### Default Category Weights:
- **Correctness:** 60%
- **Edge Cases:** 15%
- **Performance:** 15%
- **Security:** 10% (scaled to 25% in the Security domain)

$$\text{Correctness Portion} = 80 \times \left( 0.20 \times \text{Score}_{\text{novice}} + 0.35 \times \text{Score}_{\text{adept}} + 0.45 \times \text{Score}_{\text{master}} \right)$$

---

## 3. AI Usage Efficiency Formula (Max 20 Points)

Computed exclusively on Adept and Master tasks (Novice has no AI assistant):

| Component | Weight | Target Metric |
| :--- | :--- | :--- |
| **Progress-per-Hint** | 35% | $\Delta(\text{tests passing})$ measured in the 5 minutes following a hint |
| **Testing Rhythm** | 25% | Healthy test frequency (1–6 runs per 10 active minutes) and test-after-edit discipline |
| **Independence Before Asking** | 15% | Active problem-solving and test runs attempted before first hint |
| **Hint Level Discipline** | 10% | Step-by-step escalation (no skipping from L1 directly to L4) |
| **Integrity Hygiene** | 10% | Zero prompt-injection or jailbreak extraction attempts |
| **Hint Economy** | 5% | Hints utilized relative to total task hint budget |

### Independence Rule
If a candidate completes Adept and Master tasks without requesting any hints, they are awarded **85% of the AI component (17 / 20 points)** if their testing rhythm is healthy. Independent problem-solving is rewarded without penalizing those who do not require AI assistance.

---

## 4. Outcome Bands

- **Strong Hire:** $\ge 85$
- **Hire:** $70 - 84$
- **Borderline:** $50 - 69$
- **Not yet:** $< 50$

