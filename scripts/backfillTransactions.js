import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildTransactionsFromReceipt } from '../src/server/transactionsBuilder.js';

const initFirebaseAdmin = () => {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  }
  if (serviceAccount.private_key?.includes('\\n')) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { uid: null, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--uid') {
      result.uid = args[i + 1];
      i += 1;
    } else if (args[i] === '--dry-run') {
      result.dryRun = true;
    } else if (!result.uid && !args[i].startsWith('--')) {
      result.uid = args[i];
    }
  }
  return result;
};

const buildTransactionId = (uid, receiptId, index) => `${uid}_${receiptId}_${index}`;

const writeTransactions = async (db, uid, receiptId, receiptData, dryRun) => {
  const transactions = buildTransactionsFromReceipt(receiptData, receiptId, uid);
  if (dryRun) {
    return transactions.length;
  }

  const batch = db.batch();
  transactions.forEach((tx, index) => {
    const txId = buildTransactionId(uid, receiptId, index);
    const ref = db.doc(`transactions/${txId}`);
    batch.set(ref, tx, { merge: true });
  });
  await batch.commit();
  return transactions.length;
};

const run = async () => {
  const { uid, dryRun } = parseArgs();
  initFirebaseAdmin();
  const db = getFirestore();

  const userIds = [];
  if (uid) {
    userIds.push(uid);
  } else {
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach((docSnap) => userIds.push(docSnap.id));
  }

  let totalReceipts = 0;
  let totalTransactions = 0;

  for (const userId of userIds) {
    const receiptsSnap = await db.collection('users').doc(userId).collection('receipts').get();
    for (const receiptDoc of receiptsSnap.docs) {
      totalReceipts += 1;
      const count = await writeTransactions(db, userId, receiptDoc.id, receiptDoc.data(), dryRun);
      totalTransactions += count;
    }
  }

  const summary = `Backfill complete. receipts=${totalReceipts} transactions=${totalTransactions} dryRun=${dryRun}`;
  // eslint-disable-next-line no-console
  console.log(summary);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Backfill failed:', error);
  process.exit(1);
});
