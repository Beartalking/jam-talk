import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export async function redirectToCheckout(priceId, testMode = false) {
  const stripe = await stripePromise;
  
  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  // Use test price ID if in test mode or development
  const forceTestMode = localStorage.getItem('jamtalk_test_mode') === 'true';
  const isTestMode = testMode || import.meta.env.DEV || window.location.hostname === 'localhost' || forceTestMode;
  // Use test price ID in test mode
  const testPriceId = 'price_1RjTG9RPpCqX9umiBI3d50mk'; // Your test price ID
  const finalPriceId = isTestMode ? testPriceId : priceId;

  console.log('Checkout mode:', isTestMode ? 'TEST' : 'LIVE');
  console.log('Using price ID:', finalPriceId);

  try {
    // Redirect to Stripe Checkout
    const { error } = await stripe.redirectToCheckout({
      lineItems: [
        {
          price: finalPriceId, // This should be a price ID (price_xxx), not product ID (prod_xxx)
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