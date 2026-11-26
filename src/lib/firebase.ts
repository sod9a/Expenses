import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDWWFXtMN8foAlJUZSRPbwsqTxjsMpiPBo',
  authDomain: 'expenses-f1216.firebaseapp.com',
  projectId: 'expenses-f1216',
  storageBucket: 'expenses-f1216.firebasestorage.app',
  messagingSenderId: '139875989789',
  appId: '1:139875989789:web:1d5ff13fdb4156114d49f4'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
