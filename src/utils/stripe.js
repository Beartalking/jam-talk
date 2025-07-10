import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export async function redirectToCheckout(priceId) {
  const stripe = await stripePromise;
  
  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  // Redirect to Stripe Checkout
  const { error } = await stripe.redirectToCheckout({
    lineItems: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    successUrl: `${window.location.origin}/success`,
    cancelUrl: `${window.location.origin}/`,
    allowPromotionCodes: true,
  });

  if (error) {
    throw error;
  }
} 