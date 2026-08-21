import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, increment, serverTimestamp, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
        error: error instanceof Error ? error.message : String(error),
        operationType,
        path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
}

export async function saveUserEmail(email: string) {
    const emailId = email.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const pathForWrite = `emails/${emailId}`;
    
    try {
        const docRef = doc(db, 'emails', emailId);
        const docSnap = await getDoc(docRef).catch(() => null); // Catch in case of permission issues or no network
        const isNew = !docSnap || !docSnap.exists();
        
        await setDoc(docRef, {
            email: email,
            createdAt: serverTimestamp()
        });
        
        if (isNew) {
            await incrementGlobalStat('totalUsers');
        }
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    }
}

export async function incrementGlobalStat(statName: 'totalUsers' | 'totalGamesPlayed') {
    const statsRef = doc(db, 'stats', 'global');
    try {
        await updateDoc(statsRef, {
            [statName]: increment(1)
        });
    } catch (error: any) {
        // If the document doesn't exist yet, updateDoc will fail. We catch and create it.
        if (error.code === 'not-found') {
            try {
                await setDoc(statsRef, {
                    totalUsers: statName === 'totalUsers' ? 1 : 0,
                    totalGamesPlayed: statName === 'totalGamesPlayed' ? 1 : 0
                }, { merge: true });
            } catch (innerError) {
                console.error("Failed to initialize stats doc:", innerError);
            }
        } else {
            console.error("Failed to increment stat:", error);
        }
    }
}

export function subscribeToGlobalStats(callback: (stats: { totalUsers: number, totalGamesPlayed: number }) => void) {
    const statsRef = doc(db, 'stats', 'global');
    return onSnapshot(statsRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            callback({
                totalUsers: data.totalUsers || 0,
                totalGamesPlayed: data.totalGamesPlayed || 0
            });
        } else {
            callback({ totalUsers: 0, totalGamesPlayed: 0 });
        }
    });
}
