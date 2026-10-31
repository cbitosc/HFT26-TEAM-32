// Server-side Firebase Admin for Next.js API routes
// Uses Firebase Realtime Database via robust native HTTPS REST calls (no undici terminated issues)
import https from 'https';
import { URL } from 'url';

const FIREBASE_DB_URL = 'https://cybercbit-default-rtdb.firebaseio.com';

function httpsRequest(urlString: string, method = 'GET', data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    const bodyString = data !== undefined ? JSON.stringify(data) : null;

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        ...(bodyString ? { 'Content-Length': Buffer.byteLength(bodyString) } : {}),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Firebase HTTP error: ${res.statusCode} - ${raw.slice(0, 200)}`));
        }
        try {
          const parsed = raw.trim() ? JSON.parse(raw) : null;
          resolve(parsed);
        } catch {
          resolve(raw);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Firebase request timed out after 10s'));
    });

    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

async function fbFetch(path: string, method = 'GET', body?: any) {
  const url = `${FIREBASE_DB_URL}/${path}.json`;
  return httpsRequest(url, method, body);
}

async function fbPut(path: string, data: any) {
  const url = `${FIREBASE_DB_URL}/${path}.json`;
  return httpsRequest(url, 'PUT', data);
}

async function fbPatch(path: string, data: any) {
  const url = `${FIREBASE_DB_URL}/${path}.json`;
  return httpsRequest(url, 'PATCH', data);
}

async function fbPost(path: string, data: any) {
  const url = `${FIREBASE_DB_URL}/${path}.json`;
  return httpsRequest(url, 'POST', data);
}

export const firebaseDb = {
  get: fbFetch,
  put: fbPut,
  patch: fbPatch,
  post: fbPost,

  async saveCandidate(candidateId: string, data: any) {
    return fbPut(`candidates/${candidateId}`, {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async saveCandidateQuestions(candidateId: string, questions: any) {
    return fbPut(`candidates/${candidateId}/questions`, questions);
  },

  async saveCandidateAnswers(candidateId: string, answers: any, scores: any, report?: any) {
    return fbPatch(`candidates/${candidateId}`, {
      answers,
      scores,
      ...(report ? { report } : {}),
      status: 'completed',
      completedAt: Date.now(),
    });
  },

  async getCandidate(candidateId: string) {
    return fbFetch(`candidates/${candidateId}`);
  },

  async getAllCandidates() {
    const data = await fbFetch('candidates');
    if (!data) return [];
    return Object.entries(data).map(([id, val]: [string, any]) => ({
      id,
      ...val,
    }));
  },
};

export const collections: any = {
  assessments: () => ({ doc: () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => ({}) }) }) }),
  reports: () => ({ doc: () => ({ set: async () => {} }) }),
  telemetry: () => ({ doc: () => ({ set: async () => {} }) }),
};
export const getFirestoreDb = () => null;
