export const SELECTORS = {
  userBadge: '[data-testid="user-badge"]',
  pickupInput: '#sender-addr',
  dropoffInput: '#receiver-addr',
  schedulePicker: '[data-testid="schedule-picker"]',
  timeInput: '#pickup-time',
  rateCard: '[data-testid="rate-card"]',
  priceAmount: '[data-testid="rate-amount"]',
  estimatedDropoff: '[data-testid="delivery-date"]',
  courierName: '[data-testid="courier-name"]',
  unavailableMsg: '[data-testid="no-courier"], .no-service, .area-unavailable',
} as const;
