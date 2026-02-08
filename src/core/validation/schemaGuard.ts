import { z } from "zod";
import { SchemaMismatchError } from "../openclaw/errors.js";
import type { QuoteResult } from "../partners/DeliveryPartner.js";

const QuoteResultSchema = z.object({
  partner: z.string(),
  availability: z.boolean(),
  price: z.object({ amount: z.number().nonnegative(), currency: z.literal("SGD") }),
  estimated_dropoff_time: z.string(),
  meta: z.record(z.unknown()).optional(),
});

export function schemaGuard(partnerId: string, data: unknown): QuoteResult {
  const parsed = QuoteResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new SchemaMismatchError(partnerId, parsed.error.message);
  }
  const result = parsed.data as QuoteResult;

  // If available, price must be positive and dropoff time must be non-empty
  if (result.availability) {
    if (result.price.amount <= 0) {
      throw new SchemaMismatchError(partnerId, "Available partner returned zero/negative price");
    }
    if (!result.estimated_dropoff_time) {
      throw new SchemaMismatchError(partnerId, "Available partner returned empty dropoff time");
    }
  }

  return result;
}
