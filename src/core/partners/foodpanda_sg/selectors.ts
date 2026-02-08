export const SELECTORS = {
  profileIcon: '[data-testid="profile-icon"]',
  pickupInput: '#from-address',
  dropoffInput: '#to-address',
  scheduleToggle: '[data-testid="schedule-toggle"]',
  timeInput: '#schedule-datetime',
  resultCard: '[data-testid="result-card"]',
  priceAmount: '[data-testid="total-fee"]',
  estimatedDropoff: '[data-testid="dropoff-eta"]',
  unavailableMsg: '[data-testid="not-available"], .no-riders, .out-of-area',
} as const;
