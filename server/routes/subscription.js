import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Plan metadata shown to the client (prices are illustrative placeholders
// that you replace with your real Stripe price IDs before launch).
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      '15 AI tutor messages / day',
      '3 quizzes / month',
      '5 uploaded materials',
      '2 flashcard sets',
      'Basic explanations',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 4.99,
    period: '/month',
    features: [
      'Unlimited AI study sessions',
      'Unlimited quizzes & flashcards',
      'More document uploads',
      'Advanced AI explanations',
      'Exam preparation mode',
      'Study analytics',
      'Personalized revision plans',
    ],
  },
};

// Current plan + usage.
router.get('/', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id);
  res.json({
    plan: req.user.plan,
    plans: PLANS,
    subscription: sub || null,
  });
});

// ------------------------------------------------------------------
// Checkout entry point.
// A REAL payment provider (e.g. Stripe) is expected here. In production
// this endpoint creates a Stripe Checkout Session and returns its URL.
//
// TO CONNECT STRIPE (do this before launch):
//   1. npm install stripe
//   2. Add STRIPE_SECRET_KEY and STRIPE_PRICE_PRO to server/.env
//   3. Replace the body of this route with a real createCheckoutSession call.
//
// We intentionally do NOT fake payment success.
// ------------------------------------------------------------------
router.post('/checkout', (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({
      error: 'PAYMENT_NOT_CONFIGURED',
      message:
        'Pro subscriptions are ready to connect to a real payment provider (Stripe). Add your STRIPE_SECRET_KEY and STRIPE_PRICE_PRO to server/.env, then this checkout will open the Stripe payment page. No payment is processed until then.',
    });
  }
  res.status(501).json({
    error: 'PAYMENT_NOT_CONFIGURED',
    message: 'Stripe integration code goes here. See README "Monetization" section.',
  });
});

export default router;
