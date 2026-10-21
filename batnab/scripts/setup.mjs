// Run by the deploy workflow with the service account (GOOGLE_APPLICATION_CREDENTIALS):
//  - turns on username/password sign-in (Firebase Auth's Email/Password provider);
//  - creates the teacher account "Admin" with the password from ADMIN_PASSWORD (only if it doesn't exist yet,
//    or when RESET_ADMIN_PASSWORD=true), and makes it the site's only admin;
//  - fills in default settings.
// Against the emulators (FIREBASE_AUTH_EMULATOR_HOST / FIREBASE_DATABASE_EMULATOR_HOST) it needs no credentials.
import {applicationDefault, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';

const PROJECT = 'rgtbn-bb94f';
const ADMIN = 'admin';
const ADMIN_EMAIL = `${ADMIN}@batnab.web.app`;
// The teacher's earlier login name; an account with it is renamed to ADMIN, keeping its password.
const OLD_EMAIL = 'teacher001@batnab.web.app';
const emulated = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const password = process.env.ADMIN_PASSWORD ?? '';
const reset = process.env.RESET_ADMIN_PASSWORD === 'true';

const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `WARNING: ${msg}`);

initializeApp({
  projectId: PROJECT,
  databaseURL: emulated ? `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${PROJECT}-default-rtdb` : `https://${PROJECT}-default-rtdb.firebaseio.com`,
  ...(emulated ? {} : {credential: applicationDefault()}),
});
const auth = getAuth();
const db = getDatabase();

async function enableEmailSignIn() {
  if (emulated) return;
  try {
    const {access_token: token} = await applicationDefault().getAccessToken();
    const res = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
      method: 'PATCH',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': PROJECT},
      body: JSON.stringify({signIn: {email: {enabled: true, passwordRequired: true}}}),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    console.log('Email/password sign-in: enabled');
  } catch (e) {
    warn(`Could not turn on Email/Password sign-in automatically (${e.message}). Turn it on in Firebase Console → Authentication → Sign-in method.`);
  }
}

const byEmail = (email) =>
  auth.getUserByEmail(email).catch((e) => {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  });

async function teacher() {
  let user = await byEmail(ADMIN_EMAIL);
  const old = user ? null : await byEmail(OLD_EMAIL);
  if (old) {
    user = await auth.updateUser(old.uid, {email: ADMIN_EMAIL, displayName: 'Admin'});
    console.log('Teacher001 renamed to Admin');
  }
  if (!user) {
    if (password.length < 6) {
      warn('The teacher account Admin does not exist yet: add the repository secret BATNAB_ADMIN_PASSWORD (at least 6 characters) and run the workflow again.');
      return null;
    }
    user = await auth.createUser({email: ADMIN_EMAIL, password, displayName: 'Admin'});
    console.log('Admin: created');
  } else if (reset) {
    if (password.length < 6) warn('RESET_ADMIN_PASSWORD is set but BATNAB_ADMIN_PASSWORD is missing or shorter than 6 characters.');
    else {
      await auth.updateUser(user.uid, {password});
      console.log('Admin: password reset');
    }
  } else console.log('Admin: exists');
  if (user.disabled) await auth.updateUser(user.uid, {disabled: false});

  await db.ref('admins').set({[user.uid]: true});
  const profile = db.ref(`users/${user.uid}`);
  if (!(await profile.child('username').get()).exists()) await profile.update({username: ADMIN, name: 'Багш', createdAt: Date.now()});
  else await profile.update({username: ADMIN});
  return user.uid;
}

async function settings() {
  const s = (await db.ref('settings').get()).val() ?? {};
  const patch = {};
  if (typeof s.trial !== 'string') patch.trial = '1A';
  if (typeof s.retakes !== 'boolean') patch.retakes = true;
  if (Object.keys(patch).length) await db.ref('settings').update(patch);
  console.log('Settings:', {...s, ...patch});
}

await enableEmailSignIn();
await teacher();
await settings();
process.exit(0);
