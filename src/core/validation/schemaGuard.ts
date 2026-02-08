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
  return parsed.data as QuoteResult;
}
