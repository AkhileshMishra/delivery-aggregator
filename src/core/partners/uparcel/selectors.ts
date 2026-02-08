export const SELECTORS = {
  loginIndicator: '[data-testid="logged-in"]',
  pickupInput: '#pickup-addr',
  dropoffInput: '#delivery-addr',
  dateTimePicker: '[data-testid="datetime-picker"]',
  timeInput: '#pickup-datetime',
  quoteResult: '[data-testid="quote-result"]',
  priceAmount: '[data-testid="price"]',
  estimatedDropoff: '[data-testid="eta"]',
  deliveryType: '[data-testid="delivery-type"]',
} as const;