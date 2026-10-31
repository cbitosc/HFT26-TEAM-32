import { TaskSpec } from '@proctor-forge/shared';

export const ML_TASKS: TaskSpec[] = [
  // 1. NOVICE Variant A (ML)
  {
    id: 'ml_novice_a',
    tier: 'novice',
    domain: 'ml',
    language: 'python',
    framework: 'scikit-learn',
    dsaTopics: ['arrays', 'math'],
    title: 'Zero-Leakage Feature Standard Scaler',
    scenario: 'Data preprocessing pipeline fitting means and variances strictly on train splits without data snooping.',
    problemStatement: `Implement \`StandardScaler\` in \`scaler.py\`.
Methods required:
1. \`fit(X: list[list[float]]) -> None\`: compute column-wise mean and population standard deviation (\`std = sqrt(variance)\`).
   - If a column has variance 0 (or \`std == 0\`), set its scale to 1.0 to avoid division by zero.
2. \`transform(X: list[list[float]]) -> list[list[float]]\`: return normalized values: \`z = (x - mean) / std\`.
3. \`fit_transform(X: list[list[float]]) -> list[list[float]]\`: convenient combination.`,
    constraints: ['Must handle zero-variance features safely', 'Strict column-wise calculation'],
    acceptanceCriteria: ['Transformed mean is 0 and std is 1 for non-degenerate data', 'Prevents divide by zero'],
    files: [
      {
        path: 'scaler.py',
        content: `import math

class StandardScaler:
    def __init__(self):
        self.means = []
        self.stds = []

    def fit(self, X: list[list[float]]) -> None:
        # BUG: Missing column-wise variance logic
        pass

    def transform(self, X: list[list[float]]) -> list[list[float]]:
        return X

    def fit_transform(self, X: list[list[float]]) -> list[list[float]]:
        self.fit(X)
        return self.transform(X)
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'scaler.py',
        content: `import math

class StandardScaler:
    def __init__(self):
        self.means = []
        self.stds = []

    def fit(self, X: list[list[float]]) -> None:
        if not X or not X[0]:
            return
        n_rows = len(X)
        n_cols = len(X[0])

        self.means = [0.0] * n_cols
        for row in X:
            for j in range(n_cols):
                self.means[j] += row[j]
        self.means = [m / n_rows for m in self.means]

        self.stds = [0.0] * n_cols
        for row in X:
            for j in range(n_cols):
                diff = row[j] - self.means[j]
                self.stds[j] += diff * diff

        self.stds = [math.sqrt(s / n_rows) for s in self.stds]
        # Replace zero std with 1.0 to avoid division by zero
        self.stds = [1.0 if s == 0.0 else s for s in self.stds]

    def transform(self, X: list[list[float]]) -> list[list[float]]:
        if not X or not self.means:
            return X
        n_cols = len(self.means)
        result = []
        for row in X:
            scaled_row = []
            for j in range(n_cols):
                scaled_row.append((row[j] - self.means[j]) / self.stds[j])
            result.append(scaled_row)
        return result

    def fit_transform(self, X: list[list[float]]) -> list[list[float]]:
        self.fit(X)
        return self.transform(X)
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_standard_norm', name: 'Standard Feature Normalization', weight: 1, category: 'correctness' },
        { id: 'test_zero_variance', name: 'Zero Variance Feature Handling', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_train_test_split_consistency', name: 'Apply Train Scale to Separate Test Set', weight: 2, category: 'edge' },
        { id: 'test_multidimensional', name: 'Multi-Feature Vector Columns', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_scaler.py',
        content: `import unittest
from scaler import StandardScaler

class TestScaler(unittest.TestCase):
    def test_standard_norm(self):
        X = [[10.0], [20.0], [30.0]]
        scaler = StandardScaler()
        scaled = scaler.fit_transform(X)
        self.assertAlmostEqual(scaled[1][0], 0.0, places=4)
        self.assertAlmostEqual(scaled[0][0], -scaled[2][0], places=4)

    def test_zero_variance(self):
        X = [[5.0], [5.0], [5.0]]
        scaler = StandardScaler()
        scaled = scaler.fit_transform(X)
        self.assertEqual(scaled, [[0.0], [0.0], [0.0]])

    def test_train_test_split_consistency(self):
        train = [[0.0], [10.0]]
        test = [[5.0], [15.0]]
        scaler = StandardScaler()
        scaler.fit(train)
        scaled_test = scaler.transform(test)
        self.assertAlmostEqual(scaled_test[0][0], 0.0, places=4)
        self.assertAlmostEqual(scaled_test[1][0], 2.0, places=4)

    def test_multidimensional(self):
        X = [[1.0, 100.0], [3.0, 200.0], [5.0, 300.0]]
        scaler = StandardScaler()
        scaled = scaler.fit_transform(X)
        self.assertEqual(len(scaled), 3)
        self.assertEqual(len(scaled[0]), 2)
        self.assertAlmostEqual(scaled[1][0], 0.0, places=4)
        self.assertAlmostEqual(scaled[1][1], 0.0, places=4)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Compute mean for each column j: sum(row[j] for row in X) / len(X).',
      level2: 'Compute variance as sum((row[j] - mean)^2 for row in X) / len(X).',
      level3: 'Set std = math.sqrt(variance). If std is 0.0, set std to 1.0 to avoid ZeroDivisionError.',
      level4: 'In transform, compute (val - mean[j]) / std[j] for each coordinate.'
    },
    seed: 301
  },

  // 2. NOVICE Variant B (ML)
  {
    id: 'ml_novice_b',
    tier: 'novice',
    domain: 'ml',
    language: 'python',
    framework: 'scikit-learn',
    dsaTopics: ['arrays', 'math'],
    title: 'Binary Classification Metric Evaluator',
    scenario: 'Model validation harness computing precision, recall, and F1-score with zero-division safety.',
    problemStatement: `Implement \`evaluate_binary_metrics(y_true, y_pred)\` in \`metrics.py\`.
Calculate:
1. \`tp\` (True Positives), \`fp\` (False Positives), \`tn\` (True Negatives), \`fn\` (False Negatives).
2. \`precision = tp / (tp + fp)\` (if \`tp + fp == 0\`, return 0.0).
3. \`recall = tp / (tp + fn)\` (if \`tp + fn == 0\`, return 0.0).
4. \`f1 = 2 * (precision * recall) / (precision + recall)\` (if \`precision + recall == 0\`, return 0.0).
5. \`accuracy = (tp + tn) / total\`.
Return dictionary with keys: \`accuracy\`, \`precision\`, \`recall\`, \`f1\`, \`tp\`, \`fp\`, \`tn\`, \`fn\`.`,
    constraints: ['Zero-division safety guards', 'Binary labels 0 and 1'],
    acceptanceCriteria: ['All metrics bounded in [0, 1]', 'Accurately computes confusion counts'],
    files: [
      {
        path: 'metrics.py',
        content: `def evaluate_binary_metrics(y_true: list[int], y_pred: list[int]) -> dict:
    # BUG: Naive division causing ZeroDivisionError
    return {}
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'metrics.py',
        content: `def evaluate_binary_metrics(y_true: list[int], y_pred: list[int]) -> dict:
    if len(y_true) != len(y_pred) or not y_true:
        return {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0, "tp": 0, "fp": 0, "tn": 0, "fn": 0}

    tp = fp = tn = fn = 0
    for yt, yp in zip(y_true, y_pred):
        if yt == 1 and yp == 1:
            tp += 1
        elif yt == 0 and yp == 1:
            fp += 1
        elif yt == 0 and yp == 0:
            tn += 1
        elif yt == 1 and yp == 0:
            fn += 1

    total = len(y_true)
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn
    }
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_perfect_predictions', name: 'Perfect Predictions (1.0 Metrics)', weight: 1, category: 'correctness' },
        { id: 'test_imbalanced_edge', name: 'All Negative Predictions (Zero Division Guard)', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_mixed_metrics', name: 'Mixed Predictions Confusion Matrix', weight: 1, category: 'edge' },
        { id: 'test_f1_harmonic_mean', name: 'F1 Harmonic Mean Formula Accuracy', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_metrics.py',
        content: `import unittest
from metrics import evaluate_binary_metrics

class TestMetrics(unittest.TestCase):
    def test_perfect_predictions(self):
        res = evaluate_binary_metrics([1, 0, 1, 0], [1, 0, 1, 0])
        self.assertEqual(res["accuracy"], 1.0)
        self.assertEqual(res["precision"], 1.0)
        self.assertEqual(res["recall"], 1.0)
        self.assertEqual(res["f1"], 1.0)

    def test_imbalanced_edge(self):
        res = evaluate_binary_metrics([1, 1], [0, 0])
        self.assertEqual(res["precision"], 0.0)
        self.assertEqual(res["recall"], 0.0)
        self.assertEqual(res["f1"], 0.0)
        self.assertEqual(res["fn"], 2)

    def test_mixed_metrics(self):
        # 2 TP, 1 FP, 1 TN, 1 FN
        y_true = [1, 1, 0, 0, 1]
        y_pred = [1, 1, 1, 0, 0]
        res = evaluate_binary_metrics(y_true, y_pred)
        self.assertEqual(res["tp"], 2)
        self.assertEqual(res["fp"], 1)
        self.assertEqual(res["tn"], 1)
        self.assertEqual(res["fn"], 1)
        self.assertAlmostEqual(res["precision"], 2 / 3, places=3)
        self.assertAlmostEqual(res["recall"], 2 / 3, places=3)

    def test_f1_harmonic_mean(self):
        y_true = [1, 1, 1, 0]
        y_pred = [1, 0, 0, 0]
        res = evaluate_binary_metrics(y_true, y_pred)
        self.assertEqual(res["precision"], 1.0)
        self.assertAlmostEqual(res["recall"], 1/3, places=3)
        # 2 * (1 * 1/3) / (1 + 1/3) = 0.5
        self.assertAlmostEqual(res["f1"], 0.5, places=3)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Iterate with zip(y_true, y_pred) and tally counts for TP, FP, TN, and FN.',
      level2: 'Precision is tp / (tp + fp) if (tp + fp) > 0 else 0.0.',
      level3: 'Recall is tp / (tp + fn) if (tp + fn) > 0 else 0.0.',
      level4: 'F1 is the harmonic mean: 2 * (precision * recall) / (precision + recall) if denominator > 0 else 0.0.'
    },
    seed: 302
  },

  // 3. ADEPT Variant A (ML)
  {
    id: 'ml_adept_a',
    tier: 'adept',
    domain: 'ml',
    language: 'python',
    framework: 'scikit-learn',
    dsaTopics: ['math', 'hashing', 'strings'],
    title: 'TF-IDF Vectorizer & Cosine Similarity',
    scenario: 'Information retrieval engine ranking document relevance using Term Frequency - Inverse Document Frequency.',
    problemStatement: `Implement \`TfidfEngine\` in \`tfidf.py\`.
Requirements:
1. \`fit(documents: list[str])\`: build vocabulary and compute document frequencies:
   \`idf(term) = log((1 + N) / (1 + df(term))) + 1\` (smooth IDF).
2. \`transform(documents: list[str]) -> list[list[float]]\`:
   - Compute normalized TF: \`tf(t, d) = count(t, d) / len(words_in_d)\`.
   - \`tfidf = tf * idf\`.
   - L2 normalize each document vector: \`v_norm = v / sqrt(sum(v_i^2))\`.
3. \`cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float\`: compute dot product of L2-normalized vectors.`,
    constraints: ['Zero division safety', 'Consistent vocabulary tokenization'],
    acceptanceCriteria: ['Identical documents have similarity 1.0', 'Orthogonal documents have similarity 0.0'],
    files: [
      {
        path: 'tfidf.py',
        content: `import math

class TfidfEngine:
    def __init__(self):
        self.vocab = {}
        self.idf = {}

    def fit(self, documents: list[str]) -> None:
        pass

    def transform(self, documents: list[str]) -> list[list[float]]:
        return []

    def cosine_similarity(self, v1: list[float], v2: list[float]) -> float:
        return 0.0
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'tfidf.py',
        content: `import math

class TfidfEngine:
    def __init__(self):
        self.vocab = {}
        self.idf = {}

    def _tokenize(self, doc: str) -> list[str]:
        return [w.lower() for w in doc.split() if w.strip()]

    def fit(self, documents: list[str]) -> None:
        N = len(documents)
        df = {}
        unique_words = set()

        for doc in documents:
            words = set(self._tokenize(doc))
            unique_words.update(words)
            for w in words:
                df[w] = df.get(w, 0) + 1

        sorted_vocab = sorted(list(unique_words))
        self.vocab = {w: i for i, w in enumerate(sorted_vocab)}

        for w, count in df.items():
            self.idf[w] = math.log((1 + N) / (1 + count)) + 1.0

    def transform(self, documents: list[str]) -> list[list[float]]:
        if not self.vocab:
            return []
        
        vectors = []
        vocab_size = len(self.vocab)

        for doc in documents:
            words = self._tokenize(doc)
            vec = [0.0] * vocab_size
            if not words:
                vectors.append(vec)
                continue

            doc_len = len(words)
            tf = {}
            for w in words:
                tf[w] = tf.get(w, 0) + 1

            for w, count in tf.items():
                if w in self.vocab:
                    idx = self.vocab[w]
                    tf_val = count / doc_len
                    idf_val = self.idf.get(w, 1.0)
                    vec[idx] = tf_val * idf_val

            # L2 normalization
            norm = math.sqrt(sum(x * x for x in vec))
            if norm > 0:
                vec = [x / norm for x in vec]
            vectors.append(vec)

        return vectors

    def cosine_similarity(self, v1: list[float], v2: list[float]) -> float:
        if len(v1) != len(v2) or not v1:
            return 0.0
        return sum(a * b for a, b in zip(v1, v2))
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_vocab_fit', name: 'Deterministic Vocabulary & IDF Calculation', weight: 1, category: 'correctness' },
        { id: 'test_self_similarity', name: 'Self Cosine Similarity Equals 1.0', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_orthogonal_docs', name: 'Disjoint Documents Have 0.0 Cosine Similarity', weight: 2, category: 'edge' },
        { id: 'test_l2_normalization', name: 'Vector Length Strict L2 Unit Norm', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_tfidf.py',
        content: `import unittest
import math
from tfidf import TfidfEngine

class TestTfidf(unittest.TestCase):
    def test_vocab_fit(self):
        engine = TfidfEngine()
        engine.fit(["apple banana", "apple orange"])
        self.assertIn("apple", engine.vocab)
        self.assertIn("banana", engine.vocab)
        self.assertIn("orange", engine.vocab)

    def test_self_similarity(self):
        engine = TfidfEngine()
        engine.fit(["data science and machine learning", "web frontend and backend"])
        vecs = engine.transform(["data science"])
        sim = engine.cosine_similarity(vecs[0], vecs[0])
        self.assertAlmostEqual(sim, 1.0, places=4)

    def test_orthogonal_docs(self):
        engine = TfidfEngine()
        engine.fit(["alpha beta", "gamma delta"])
        vecs = engine.transform(["alpha beta", "gamma delta"])
        sim = engine.cosine_similarity(vecs[0], vecs[1])
        self.assertAlmostEqual(sim, 0.0, places=4)

    def test_l2_normalization(self):
        engine = TfidfEngine()
        engine.fit(["deep neural networks for vision"])
        vec = engine.transform(["deep vision"])[0]
        norm = math.sqrt(sum(x * x for x in vec))
        self.assertAlmostEqual(norm, 1.0, places=4)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Document frequency (df) is the number of documents in which a word appears at least once.',
      level2: 'IDF formula: math.log((1 + N) / (1 + df)) + 1.0.',
      level3: 'After multiplying TF * IDF for each index, compute L2 norm = sqrt(sum(v_i^2)) and divide vector by norm.',
      level4: 'Cosine similarity of two L2 normalized vectors is simply their dot product: sum(a * b for a, b in zip(v1, v2)).'
    },
    seed: 303
  },

  // 4. ADEPT Variant B (ML)
  {
    id: 'ml_adept_b',
    tier: 'adept',
    domain: 'ml',
    language: 'python',
    framework: 'scikit-learn',
    dsaTopics: ['arrays', 'sorting'],
    title: 'Stratified K-Fold Cross-Validation Partitioning',
    scenario: 'Train/test split generator preserving class label distributions across cross-validation folds.',
    problemStatement: `Implement \`StratifiedKFold\` in \`cross_val.py\`.
Requirements:
1. \`split(X, y, n_splits: int) -> list[tuple[list[int], list[int]]]\`:
   - Returns a list of \`n_splits\` folds. Each fold is a tuple: \`(train_indices, test_indices)\`.
   - Every sample index \`0 <= i < len(y)\` must appear in the test set of exactly one fold.
   - The proportion of each class label in every test fold must closely match the overall class distribution.`,
    constraints: ['No overlapping test indices across folds', 'Class distribution preserved in each fold'],
    acceptanceCriteria: ['All samples partitioned across folds', 'Stratification matches original label proportions'],
    files: [
      {
        path: 'cross_val.py',
        content: `class StratifiedKFold:
    def __init__(self, n_splits: int = 3):
        self.n_splits = n_splits

    def split(self, y: list[int]) -> list[tuple[list[int], list[int]]]:
        # BUG: Naive contiguous slice ignoring class stratification
        n = len(y)
        folds = []
        step = n // self.n_splits
        for i in range(self.n_splits):
            test = list(range(i * step, (i + 1) * step))
            train = [idx for idx in range(n) if idx not in test]
            folds.append((train, test))
        return folds
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'cross_val.py',
        content: `class StratifiedKFold:
    def __init__(self, n_splits: int = 3):
        self.n_splits = n_splits

    def split(self, y: list[int]) -> list[tuple[list[int], list[int]]]:
        # Group indices by class label
        class_indices = {}
        for idx, label in enumerate(y):
            if label not in class_indices:
                class_indices[label] = []
            class_indices[label].append(idx)

        # Distribute each class's indices round-robin into n_splits test buckets
        test_buckets = [[] for _ in range(self.n_splits)]
        for label, indices in class_indices.items():
            for i, idx in enumerate(indices):
                bucket_idx = i % self.n_splits
                test_buckets[bucket_idx].append(idx)

        total_indices = set(range(len(y)))
        folds = []
        for b in range(self.n_splits):
            test_idx = sorted(test_buckets[b])
            test_set = set(test_idx)
            train_idx = sorted([i for i in total_indices if i not in test_set])
            folds.append((train_idx, test_idx))

        return folds
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_fold_count_partition', name: 'Exact Fold Count & Complete Partitioning', weight: 1, category: 'correctness' },
        { id: 'test_balanced_classes', name: 'Balanced Class Proportions per Fold', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_disjoint_test_sets', name: 'Zero Overlap Across Test Partitions', weight: 2, category: 'edge' },
        { id: 'test_imbalanced_dataset', name: 'Severe Class Imbalance Stratification', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_cross_val.py',
        content: `import unittest
from cross_val import StratifiedKFold

class TestCrossVal(unittest.TestCase):
    def test_fold_count_partition(self):
        y = [0, 1] * 15 # 30 samples, 15 each
        skf = StratifiedKFold(n_splits=3)
        folds = skf.split(y)
        self.assertEqual(len(folds), 3)
        for train, test in folds:
            self.assertEqual(len(test), 10)
            self.assertEqual(len(train), 20)

    def test_balanced_classes(self):
        y = [0, 0, 0, 1, 1, 1]
        skf = StratifiedKFold(n_splits=3)
        folds = skf.split(y)
        for _, test in folds:
            labels = [y[i] for i in test]
            self.assertEqual(labels.count(0), 1)
            self.assertEqual(labels.count(1), 1)

    def test_disjoint_test_sets(self):
        y = [0, 1, 0, 1, 0, 1, 0, 1]
        skf = StratifiedKFold(n_splits=4)
        folds = skf.split(y)
        all_tests = []
        for _, test in folds:
            all_tests.extend(test)
        self.assertEqual(sorted(all_tests), list(range(len(y))))

    def test_imbalanced_dataset(self):
        y = [0] * 12 + [1] * 3
        skf = StratifiedKFold(n_splits=3)
        folds = skf.split(y)
        for _, test in folds:
            test_labels = [y[i] for i in test]
            self.assertEqual(test_labels.count(1), 1)
            self.assertEqual(test_labels.count(0), 4)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Group sample indices by their label: map label -> list of indices.',
      level2: 'For each class group, distribute its indices evenly across the n_splits test buckets using modulo: index % n_splits.',
      level3: 'Combine the distributed indices from all classes into the test bucket for each fold.',
      level4: 'For each fold b: test_indices = test_buckets[b], train_indices = all_indices - test_indices.'
    },
    seed: 304
  },

  // 5. MASTER Variant A (ML)
  {
    id: 'ml_master_a',
    tier: 'master',
    domain: 'ml',
    language: 'python',
    framework: 'scikit-learn',
    dsaTopics: ['math', 'arrays', 'heaps'],
    title: 'Vectorized K-Means with Convergence Guard',
    scenario: 'Unsupervised clustering pipeline calculating cluster centroids with vectorized Euclidean distances and inertia tracking.',
    problemStatement: `Implement \`KMeans\` in \`kmeans.py\`.
Requirements:
1. \`__init__(k: int, max_iter: int = 50, tol: float = 1e-4)\`.
2. \`fit(X: list[list[float]], init_centroids: list[list[float]] = None)\`:
   - If \`init_centroids\` provided, initialize with them.
   - Assignment step: assign each point to nearest centroid by Euclidean distance.
   - Update step: recompute centroid as mean of assigned points. If a centroid receives zero points, keep previous centroid.
   - Convergence check: stop early if max shift of any centroid is \`< tol\`.
3. \`predict(X: list[list[float]]) -> list[int]\`: return index of nearest centroid for each point.
4. \`inertia_\`: compute sum of squared distances of samples to their closest centroid.`,
    constraints: ['Convergence within max_iter', 'Euclidean distance metric'],
    acceptanceCriteria: ['Predicts cluster assignments correctly', 'Inertia decreases across iterations'],
    performanceBudget: {
      maxRuntimeMs: 300,
      complexityProbe: {
        inputSizes: [100, 200, 400],
        maxGrowthRatio: 2.2
      }
    },
    files: [
      {
        path: 'kmeans.py',
        content: `class KMeans:
    def __init__(self, k: int = 2, max_iter: int = 50, tol: float = 1e-4):
        self.k = k
        self.max_iter = max_iter
        self.tol = tol
        self.centroids = []
        self.inertia_ = 0.0

    def fit(self, X: list[list[float]], init_centroids: list[list[float]] = None) -> None:
        # BUG: Stub implementation
        self.centroids = init_centroids or []

    def predict(self, X: list[list[float]]) -> list[int]:
        return [0] * len(X)
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'kmeans.py',
        content: `import math

class KMeans:
    def __init__(self, k: int = 2, max_iter: int = 50, tol: float = 1e-4):
        self.k = k
        self.max_iter = max_iter
        self.tol = tol
        self.centroids = []
        self.inertia_ = 0.0

    def _dist_sq(self, p1: list[float], p2: list[float]) -> float:
        return sum((a - b) ** 2 for a, b in zip(p1, p2))

    def fit(self, X: list[list[float]], init_centroids: list[list[float]] = None) -> None:
        if not X:
            return

        n_features = len(X[0])
        if init_centroids:
            self.centroids = [list(c) for c in init_centroids]
        else:
            self.centroids = [list(X[i]) for i in range(min(self.k, len(X)))]

        for _ in range(self.max_iter):
            clusters = [[] for _ in range(self.k)]
            for pt in X:
                best_idx = 0
                best_dist = float('inf')
                for c_idx, c in enumerate(self.centroids):
                    d = self._dist_sq(pt, c)
                    if d < best_dist:
                        best_dist = d
                        best_idx = c_idx
                clusters[best_idx].append(pt)

            max_shift = 0.0
            new_centroids = []
            for c_idx in range(self.k):
                pts = clusters[c_idx]
                if not pts:
                    new_centroids.append(self.centroids[c_idx])
                    continue
                new_c = [0.0] * n_features
                for p in pts:
                    for j in range(n_features):
                        new_c[j] += p[j]
                new_c = [val / len(pts) for val in new_c]
                shift = math.sqrt(self._dist_sq(self.centroids[c_idx], new_c))
                if shift > max_shift:
                    max_shift = shift
                new_centroids.append(new_c)

            self.centroids = new_centroids
            if max_shift < self.tol:
                break

        # Compute final inertia
        total_inertia = 0.0
        for pt in X:
            closest_d = min(self._dist_sq(pt, c) for c in self.centroids)
            total_inertia += closest_d
        self.inertia_ = total_inertia

    def predict(self, X: list[list[float]]) -> list[int]:
        labels = []
        for pt in X:
            best_idx = 0
            best_dist = float('inf')
            for c_idx, c in enumerate(self.centroids):
                d = self._dist_sq(pt, c)
                if d < best_dist:
                    best_dist = d
                    best_idx = c_idx
            labels.append(best_idx)
        return labels
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_two_clusters', name: 'Partition Two Distinct Clusters', weight: 1, category: 'correctness' },
        { id: 'test_inertia_computed', name: 'Inertia Minimization Value', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_convergence_speed', name: 'Early Stopping Convergence On Stable Centers', weight: 2, category: 'edge' },
        { id: 'test_perf_kmeans', name: 'Clustering Scalability On 300 Vectors', weight: 2, category: 'performance' }
      ]
    },
    testFiles: [
      {
        path: 'test_kmeans.py',
        content: `import unittest
import time
from kmeans import KMeans

class TestKMeans(unittest.TestCase):
    def test_two_clusters(self):
        X = [[1.0, 1.0], [1.5, 1.2], [10.0, 10.0], [10.2, 9.8]]
        km = KMeans(k=2, max_iter=20)
        km.fit(X, init_centroids=[[1.0, 1.0], [10.0, 10.0]])
        preds = km.predict([[1.1, 1.1], [9.9, 10.1]])
        self.assertEqual(preds[0], 0)
        self.assertEqual(preds[1], 1)

    def test_inertia_computed(self):
        X = [[0.0], [2.0]]
        km = KMeans(k=1)
        km.fit(X, init_centroids=[[1.0]])
        # Mean is 1.0. (0-1)^2 + (2-1)^2 = 2.0
        self.assertAlmostEqual(km.inertia_, 2.0, places=3)

    def test_convergence_speed(self):
        X = [[0.0, 0.0], [0.1, 0.1], [10.0, 10.0], [10.1, 10.1]]
        km = KMeans(k=2, tol=1e-3)
        km.fit(X, init_centroids=[[0.0, 0.0], [10.0, 10.0]])
        self.assertLess(km.inertia_, 0.1)

    def test_perf_kmeans(self):
        # 300 data points
        X = [[float(i % 10), float(i % 5)] for i in range(200)]
        km = KMeans(k=3, max_iter=15)
        start = time.time()
        km.fit(X)
        duration_ms = (time.time() - start) * 1000
        self.assertLess(duration_ms, 250)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Squared Euclidean distance: sum((a - b)**2 for a, b in zip(p1, p2)).',
      level2: 'Assign each sample to the centroid with the minimum squared distance.',
      level3: 'Update centroids by averaging all samples assigned to each cluster.',
      level4: 'Check convergence: if max shift between old and new centroids is < tol, break iteration early.'
    },
    seed: 305
  },

  // 6. MASTER Variant B (ML)
  {
    id: 'ml_master_b',
    tier: 'master',
    domain: 'ml',
    language: 'python',
    framework: 'numpy',
    dsaTopics: ['sliding-window', 'queue', 'math'],
    title: 'Streaming Exponential Moving Average & Anomaly Detector',
    scenario: 'High-frequency telemetry stream detecting real-time outlier metric spikes using streaming Welford/EMA variance.',
    problemStatement: `Implement \`StreamingAnomalyDetector\` in \`anomaly.py\`.
Requirements:
1. \`__init__(alpha: float = 0.2, z_threshold: float = 3.0, warmup_points: int = 10)\`.
2. \`ingest(value: float) -> tuple[bool, float]\`:
   - Maintain Exponential Moving Average (\`ema\`) and Exponential Moving Variance (\`emv\`).
   - \`ema_t = alpha * x_t + (1 - alpha) * ema_{t-1}\`.
   - \`diff = x_t - ema_{t-1}\`.
   - \`emv_t = (1 - alpha) * (emv_{t-1} + alpha * diff^2)\`.
   - Standard deviation: \`sigma = sqrt(emv_t)\`.
   - Z-score: \`z = abs(x_t - ema) / sigma\` (if \`sigma < 1e-6\`, z = 0).
   - If \`point_count <= warmup_points\`, never flag as anomaly.
   - Return \`(is_anomaly, z_score)\`.`,
    constraints: ['O(1) update and memory per stream point', 'Numerical stability guard'],
    acceptanceCriteria: ['Rejects false alarms during warmup', 'Detects sharp metric spikes exceeding z_threshold'],
    performanceBudget: {
      maxRuntimeMs: 300,
      complexityProbe: {
        inputSizes: [1000, 2000, 4000],
        maxGrowthRatio: 2.1
      }
    },
    files: [
      {
        path: 'anomaly.py',
        content: `class StreamingAnomalyDetector:
    def __init__(self, alpha: float = 0.2, z_threshold: float = 3.0, warmup_points: int = 10):
        self.alpha = alpha
        self.z_threshold = z_threshold
        self.warmup_points = warmup_points

    def ingest(self, value: float) -> tuple[bool, float]:
        # BUG: Fixed stub
        return (False, 0.0)
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'anomaly.py',
        content: `import math

class StreamingAnomalyDetector:
    def __init__(self, alpha: float = 0.2, z_threshold: float = 3.0, warmup_points: int = 10):
        self.alpha = alpha
        self.z_threshold = z_threshold
        self.warmup_points = warmup_points
        self.ema = 0.0
        self.emv = 0.0
        self.count = 0

    def ingest(self, value: float) -> tuple[bool, float]:
        self.count += 1
        if self.count == 1:
            self.ema = value
            self.emv = 0.0
            return (False, 0.0)

        diff = value - self.ema
        # Update EMA
        self.ema = self.alpha * value + (1.0 - self.alpha) * self.ema
        # Update EMV (Exponential Moving Variance)
        self.emv = (1.0 - self.alpha) * (self.emv + self.alpha * (diff ** 2))

        sigma = math.sqrt(max(0.0, self.emv))
        if sigma < 1e-6:
            z_score = 0.0
        else:
            z_score = abs(value - self.ema) / sigma

        if self.count <= self.warmup_points:
            return (False, z_score)

        is_anomaly = z_score >= self.z_threshold
        return (is_anomaly, z_score)
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_warmup_period', name: 'Warmup Period Suppresses Anomalies', weight: 1, category: 'correctness' },
        { id: 'test_detect_spike', name: 'Detect Extreme Metric Outlier Spike', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_gradual_drift', name: 'Adapt To Gradual Drift Without Flagging', weight: 2, category: 'edge' },
        { id: 'test_perf_streaming', name: 'High-Throughput 5000+ Ingestion Stream', weight: 2, category: 'performance' }
      ]
    },
    testFiles: [
      {
        path: 'test_anomaly.py',
        content: `import unittest
import time
from anomaly import StreamingAnomalyDetector

class TestAnomaly(unittest.TestCase):
    def test_warmup_period(self):
        det = StreamingAnomalyDetector(warmup_points=5)
        for val in [10.0, 10.0, 500.0, 10.0, 10.0]:
            is_anom, _ = det.ingest(val)
            self.assertFalse(is_anom)

    def test_detect_spike(self):
        det = StreamingAnomalyDetector(warmup_points=10, z_threshold=1.8)
        # Warmup with consistent data
        for _ in range(15):
            det.ingest(100.0)
        # Giant spike
        is_anom, z = det.ingest(1000.0)
        self.assertTrue(is_anom)
        self.assertGreater(z, 1.8)

    def test_gradual_drift(self):
        det = StreamingAnomalyDetector(alpha=0.1, warmup_points=10, z_threshold=4.0)
        for i in range(15):
            det.ingest(10.0)
        # Drifting slowly: 10.1, 10.2, ...
        anom_found = False
        for i in range(20):
            is_anom, _ = det.ingest(10.0 + i * 0.05)
            if is_anom:
                anom_found = True
        self.assertFalse(anom_found)

    def test_perf_streaming(self):
        det = StreamingAnomalyDetector()
        start = time.time()
        for i in range(3000):
            det.ingest(float(i % 100))
        duration_ms = (time.time() - start) * 1000
        self.assertLess(duration_ms, 250)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Track count of ingested points to guard against false alerts during warmup.',
      level2: 'Initialize ema = value and emv = 0 on the first sample.',
      level3: 'Update EMV: emv = (1 - alpha) * (emv + alpha * diff^2). Compute sigma = sqrt(emv).',
      level4: 'Z-score = abs(value - ema) / sigma. If count > warmup and z_score >= z_threshold -> True.'
    },
    seed: 306
  }
];

