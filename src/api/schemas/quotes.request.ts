import { z } from "zod";

const Location = z
  .object({
    address: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((d) => d.address || (d.lat != null && d.lng != null), {
    message: "Provide either address or lat/lng",
  });

export const QuoteRequestSchema = z.object({
  source_location: Location,
  destination_location: Location,
  preferred_pickup_time: z.string().datetime({ offset: true }).nullable().optional(),
});

export type QuoteRequestDTO = z.infer<typeof QuoteRequestSchema>;
