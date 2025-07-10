// Usage tracking utility for JAM Talk
const STORAGE_KEYS = {
  USAGE_COUNT: 'jamtalk_usage_count',
  LAST_RESET: 'jamtalk_last_reset',
  SUBSCRIPTION_STATUS: 'jamtalk_subscription_status',
  USER_ID: 'jamtalk_user_id'
};

const FREE_LIMIT = 2; // Free users get 2 practices

// Generate a simple user ID for tracking
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get or create user ID
export function getUserId() {
  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  return userId;
}

// Get current usage count
export function getUsageCount() {
  const count = localStorage.getItem(STORAGE_KEYS.USAGE_COUNT);
  return count ? parseInt(count, 10) : 0;
}

// Increment usage count
export function incrementUsage() {
  const currentCount = getUsageCount();
  const newCount = currentCount + 1;
  localStorage.setItem(STORAGE_KEYS.USAGE_COUNT, newCount.toString());
  return newCount;
}

// Check if user has exceeded free limit
export function hasExceededFreeLimit() {
  const count = getUsageCount();
  const isPaid = isSubscriptionActive();
  return !isPaid && count >= FREE_LIMIT;
}

// Check if user can practice (hasn't hit limit or is paid)
export function canPractice() {
  const count = getUsageCount();
  const isPaid = isSubscriptionActive();
  return isPaid || count < FREE_LIMIT;
}

// Get remaining free practices
export function getRemainingFreePractices() {
  const count = getUsageCount();
  const isPaid = isSubscriptionActive();
  if (isPaid) return Infinity;
  return Math.max(0, FREE_LIMIT - count);
}

// Check subscription status
export function isSubscriptionActive() {
  const status = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_STATUS);
  return status === 'active';
}

// Set subscription status (call this after successful payment)
export function setSubscriptionStatus(status) {
  localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION_STATUS, status);
}

// Reset usage count (for testing or monthly reset)
export function resetUsageCount() {
  localStorage.setItem(STORAGE_KEYS.USAGE_COUNT, '0');
  localStorage.setItem(STORAGE_KEYS.LAST_RESET, Date.now().toString());
}

// Get usage stats for display
export function getUsageStats() {
  const count = getUsageCount();
  const remaining = getRemainingFreePractices();
  const isPaid = isSubscriptionActive();
  
  return {
    usageCount: count,
    remainingFree: remaining,
    isSubscribed: isPaid,
    canPractice: canPractice(),
    hasExceededLimit: hasExceededFreeLimit()
  };
} 