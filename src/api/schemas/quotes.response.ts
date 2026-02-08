import { z } from "zod";

const PartnerResult = z.object({
  partner: z.string(),
  availability: z.boolean(),
  price: z.object({ amount: z.number().nonnegative(), currency: z.literal("SGD") }),
  /** ISO-8601 datetime when available, empty string when unavailable */
  estimated_dropoff_time: z.string(),
  meta: z.record(z.unknown()).optional(),
});

const PartnerError = z.object({
  partner: z.string(),
  type: z.enum([
    "SelectorNotFound", "Timeout", "LoginExpired",
    "SchemaMismatch", "NavigationError", "CircuitOpen", "Unknown",
  ]),
  message: z.string(),
  debug_packet_id: z.string(),
  retryable: z.boolean(),
});

export const QuoteResponseSchema = z.object({
  request_id: z.string().uuid(),
  request_time: z.string().datetime({ offset: true }),
  pickup_time_used: z.string().datetime({ offset: true }),
  currency: z.literal("SGD"),
  results: z.array(PartnerResult),
  errors: z.array(PartnerError),
});

export type QuoteResponseDTO = z.infer<typeof QuoteResponseSchema>;
