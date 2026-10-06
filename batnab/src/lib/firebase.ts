import {getAnalytics, isSupported} from 'firebase/analytics';
import {initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth} from 'firebase/auth';
import {connectDatabaseEmulator, getDatabase} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBlM6H70o8AwPDxZaIGMBBI-p40MCWAIGU',
  authDomain: 'rgtbn-bb94f.firebaseapp.com',
  databaseURL: 'https://rgtbn-bb94f-default-rtdb.firebaseio.com',
  projectId: 'rgtbn-bb94f',
  storageBucket: 'rgtbn-bb94f.firebasestorage.app',
  messagingSenderId: '1042077636211',
  appId: '1:1042077636211:web:967d8864879daae360fc06',
  measurementId: 'G-XKH46PL2V8',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// `VITE_FIREBASE_EMULATORS=true npm run dev` talks to local emulators (`npx firebase-tools emulators:start --only auth,database`).
if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
} else {
  isSupported().then((ok) => ok && getAnalytics(app), () => {});
}
