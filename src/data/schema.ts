import { z } from 'zod';
import { ROLES } from './types';

const MAX_MODEL_YEAR = new Date().getFullYear() + 1;

/**
 * Build-time validation only. Imported by scripts/build-catalog.ts and by the
 * catalog tests, never by application code: keeping Zod out of the client
 * bundle is the point of the split. Runtime types live in types.ts.
 */

export const priceCurveSchema = z
  .object({
    base: z.number().positive(),
    baselineMiles: z.number().min(0).max(400_000),
    floor: z.number().positive(),
    decay: z.number().min(0.02).max(0.3),
    lowMileCap: z.number().min(1).max(3).default(1.6),
    spread: z.number().min(0.02).max(0.4).default(0.1),
    msrpNew: z.number().positive().optional(),
  })
  .refine((c) => c.floor < c.base, {
    message: 'floor must be below base',
  })
  .refine((c) => c.msrpNew === undefined || c.msrpNew >= c.base, {
    message: 'msrpNew must be at least the baseline used price',
  });

export const issueSchema = z.object({
  text: z.string().min(4),
  onsetMiles: z.number().min(0),
  typicalCostUsd: z.number().min(0),
  severity: z.enum(['annoyance', 'expensive', 'car-ending']),
});

export const vehicleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    make: z.string().min(1),
    model: z.string().min(1),
    generation: z.string().min(1),
    years: z.tuple([z.number().min(1990), z.number().max(MAX_MODEL_YEAR)]),
    status: z.enum(['current', 'discontinued']),

    roles: z.array(z.enum(ROLES)).min(1),
    bodyStyle: z.enum([
      'coupe', 'sedan', 'hatchback', 'wagon', 'convertible',
      'suv', 'truck', 'van', 'targa',
    ]),

    spec: z.object({
      seats: z.number().min(2).max(15),
      doors: z.number().min(2).max(5),
      drivetrain: z.enum(['FWD', 'RWD', 'AWD', '4WD']),
      transmissions: z
        .array(z.enum(['manual', 'automatic', 'dct', 'cvt', 'single-speed']))
        .min(1),
      cylinders: z.number().min(0).max(16),
      displacementL: z.number().min(0).max(9),
      aspiration: z.enum(['na', 'turbo', 'supercharged', 'hybrid', 'electric']),
      horsepower: z.number().min(50).max(1200),
      torqueLbFt: z.number().min(50).max(1200),
      curbWeightLb: z.number().min(1400).max(9000),
      fuel: z.enum(['gas', 'diesel', 'hybrid', 'phev', 'ev']),
      mpgCombined: z.number().min(8).max(150),
      towingLb: z.number().min(0).nullable(),
      cargoCuFt: z.number().min(0).nullable(),
      groundClearanceIn: z.number().min(0).nullable(),
    }),

    pricing: priceCurveSchema,

    ownership: z.object({
      reliabilityIndex: z.number().int().min(1).max(5),
      insuranceIndex: z.number().int().min(1).max(5),
      partsAvailability: z.number().int().min(1).max(5),
      annualMaintenanceUsd: z.number().min(0),
      diyFriendliness: z.number().int().min(1).max(5),
    }),

    notes: z.object({
      summary: z.string().min(10),
      knownIssues: z.array(issueSchema),
      whatToLookFor: z.array(z.string()),
      packages: z
        .array(
          z.object({
            name: z.string().min(1),
            years: z.tuple([z.number(), z.number()]).optional(),
            adds: z.string().min(4),
            premiumUsd: z.number().min(0),
          }),
        )
        .optional(),
      milestoneServices: z
        .array(
          z.object({
            atMiles: z.number().min(0),
            item: z.string().min(3),
            costUsd: z.number().min(0),
          }),
        )
        .optional(),
    }),
  })
  .refine((v) => v.years[0] <= v.years[1], {
    message: 'years must be ordered',
  })
  .refine((v) => (v.status === 'current' ? v.pricing.msrpNew !== undefined : true), {
    message: 'current vehicles require msrpNew',
  });

export type AuthoredVehicle = z.infer<typeof vehicleSchema>;
