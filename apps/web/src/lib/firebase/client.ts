import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, get, push, child, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "cybercbit.firebaseapp.com",
  databaseURL: "https://cybercbit-default-rtdb.firebaseio.com",
  projectId: "cybercbit",
  storageBucket: "cybercbit.firebasestorage.app",
  messagingSenderId: "956866707285",
  appId: "1:956866707285:web:8db0137ccf505d3be779dc",
  measurementId: "G-058FCS7FCL"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);

// Helper functions for Firebase Realtime Database
export async function saveCandidate(candidateId: string, data: any) {
  const dbRef = ref(database, `candidates/${candidateId}`);
  await set(dbRef, {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return candidateId;
}

export async function saveCandidateScore(candidateId: string, scores: any) {
  const dbRef = ref(database, `candidates/${candidateId}/scores`);
  await set(dbRef, {
    ...scores,
    submittedAt: Date.now()
  });
}

export async function getCandidateData(candidateId: string) {
  const dbRef = ref(database, `candidates/${candidateId}`);
  const snapshot = await get(dbRef);
  return snapshot.exists() ? snapshot.val() : null;
}

export async function getAllCandidates() {
  const dbRef = ref(database, 'candidates');
  const snapshot = await get(dbRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.entries(data).map(([id, val]: [string, any]) => ({
    id,
    ...val
  }));
}

export { ref, set, get, push, child, update, database as db };
