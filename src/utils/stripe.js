import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export async function redirectToCheckout(priceId) {
  const stripe = await stripePromise;
  
  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  try {
    // Redirect to Stripe Checkout
    const { error } = await stripe.redirectToCheckout({
      lineItems: [
        {
          price: priceId, // This should be a price ID (price_xxx), not product ID (prod_xxx)
          quantity: 1,
        },
      ],
      mode: 'subscription',
      successUrl: `${window.location.origin}/?success=true`,
      cancelUrl: `${window.location.origin}/?canceled=true`,
      billingAddressCollection: 'auto',
    });

    if (error) {
      console.error('Stripe checkout error:', error);
      throw new Error(error.message || 'Payment failed');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    throw err;
  }
} 