import OpenAI from 'openai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AggregateField, Timestamp, getFirestore } from 'firebase-admin/firestore';

const initFirebaseAdmin = () => {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (error) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } catch {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error?.message || 'parse failed'}`);
    }
  }
  if (serviceAccount.private_key?.includes('\\n')) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    initFirebaseAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
    if (!token) {
      res.status(401).json({ error: 'Missing auth token' });
      return;
    }

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    let message = req.body?.message || req.body?.question;
    if (!message && typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        message = parsed?.message || parsed?.question;
      } catch {}
    }
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing message' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
      return;
    }

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        intent: { type: 'string', enum: ['spend_total', 'user_profile'] },
        category: { type: 'string', minLength: 1 },
        startDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        currency: { type: 'string', description: 'Use ALL if currency is not specified by the user.' },
        profileField: { type: 'string', description: 'Profile field name when intent=user_profile.' },
      },
      required: ['intent', 'category', 'startDate', 'endDate', 'currency', 'profileField'],
    };

    const planResponse = await openai.responses.create({
      model: 'gpt-4o-mini',
      store: false,
      max_output_tokens: 120,
      input: [
        {
          role: 'system',
          content:
            'You convert user questions into a strict JSON query plan. ' +
            'If the user asks about spending, set intent=spend_total. If they ask about their profile (name, email), set intent=user_profile. ' +
            'If they say "this year", use the current calendar year. If they say "this month", use the current month. ' +
            'If currency is not specified, set currency="ALL". For spend_total, set category="total spending" if not specified. ' +
            'For user_profile, set profileField to the requested field (e.g., "displayName", "email"), and still fill category/startDate/endDate/currency with sensible defaults.',
        },
        { role: 'user', content: message },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'spend_query_plan',
          strict: true,
          schema,
        },
      },
    });

    const plan = JSON.parse(planResponse.output_text);
    const db = getFirestore();
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : null;
    const baseCurrency = userData?.settings?.baseCurrency || 'EUR';

    if (plan.intent === 'user_profile') {
      const field = plan.profileField || 'displayName';
      const value = userData?.[field] || userData?.settings?.[field] || null;
      const label = field === 'displayName' ? 'name' : field;
      const answer = value
        ? `Your ${label} is ${value}.`
        : `I could not find your ${label} in your profile.`;
      res.status(200).json({ answer, data: { field: label, value } });
      return;
    }

    const start = Timestamp.fromDate(new Date(`${plan.startDate}T00:00:00.000Z`));
    const end = Timestamp.fromDate(new Date(`${plan.endDate}T00:00:00.000Z`));
    const rawCategory = plan.category?.toString().trim().toLowerCase() || '';
    const isAllCategory = ['/', 'all', 'total', 'spend', 'spending', 'total spending'].includes(rawCategory);
    const category = isAllCategory ? null : rawCategory;
    const rawCurrency = plan.currency?.toString().trim().toUpperCase() || '';
    const currency = rawCurrency && rawCurrency !== 'ALL' ? rawCurrency : baseCurrency;
    let queryRef = db
      .collection('transactions')
      .where('uid', '==', uid)
      .where('date', '>=', start)
      .where('date', '<', end);

    if (category) {
      queryRef = queryRef.where('category', '==', category);
    }
    if (currency && rawCurrency !== 'ALL') {
      queryRef = queryRef.where('currency', '==', currency);
    }

    const aggSnap = await queryRef
      .aggregate({
        total: AggregateField.sum('amount'),
      })
      .get();

    const total = aggSnap.data().total || 0;
    const label = category || 'total spending';
    const answer = `You spent ${total.toFixed(2)} ${currency} on ${label} between ${plan.startDate} and ${plan.endDate}.`;

    res.status(200).json({
      answer,
      data: { total, plan },
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unexpected error' });
  }
}
