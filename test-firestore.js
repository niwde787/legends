import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    await setDoc(doc(db, 'emails', 'test_email_com'), {
      email: 'test@email.com',
      createdAt: serverTimestamp()
    });
    console.log('Success!');
  } catch (e) {
    console.error('Failed:', e);
  }
}
test();
