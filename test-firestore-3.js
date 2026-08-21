import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    const docId = 'edwin_otero_gmail_com';
    // first write
    await setDoc(doc(db, 'emails', docId), {
      email: 'edwin.otero@gmail.com',
      createdAt: serverTimestamp()
    });
    console.log('First write success');
    
    // second write (update)
    await setDoc(doc(db, 'emails', docId), {
      email: 'edwin.otero@gmail.com',
      createdAt: serverTimestamp()
    });
    console.log('Second write success!');
    process.exit(0);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
}
test();
