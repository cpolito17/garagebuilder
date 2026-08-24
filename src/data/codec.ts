import type { Vehicle, Role, Issue, Severity } from './types';

/**
 * Columnar catalog codec.
 *
 * The slim catalog is read by the app on every load, so its shape is a
 * performance decision. As JSON objects, 135 records cost 130 kB raw and
 * 37.7 kB gzipped, and 59 percent of that was repeated key names and repeated
 * string values, not information.
 *
 * Rows are fixed-order tuples, repeated strings live in dictionaries, and
 * small sets are bitmasks. Decoding is one linear pass at module load.
 *
 * The field order below is the format. Changing it changes the file, so
 * encoder and decoder are deliberately adjacent and share these constants.
 */

export const ROLE_ORDER: Role[] = [
  'sports', 'commuter', 'family', 'offroad', 'tow',
  'winter', 'grand-tourer', 'cargo', 'track', 'project',
];

export const TRANS_ORDER = ['manual', 'automatic', 'dct', 'cvt', 'single-speed'] as const;
export const SEVERITY_ORDER: Severity[] = ['annoyance', 'expensive', 'car-ending'];
export const STATUS_ORDER = ['discontinued', 'current'] as const;

export type Dictionaries = {
  make: string[];
  model: string[];
  generation: string[];
  body: string[];
  drivetrain: string[];
  fuel: string[];
  aspiration: string[];
  issueText: string[];
};

export type EncodedIssue = [textIdx: number, onsetMiles: number, costUsd: number, severityIdx: number];

export type EncodedRow = [
  id: string, makeIdx: number, modelIdx: number, genIdx: number,
  y0: number, y1: number, statusIdx: number, rolesMask: number, bodyIdx: number,
  seats: number, doors: number, drivetrainIdx: number, transMask: number,
  cylinders: number, displacementL: number, aspirationIdx: number,
  hp: number, torque: number, weight: number, fuelIdx: number, mpg: number,
  towing: number, cargo: number, clearance: number,
  base: number, baselineMiles: number, floor: number, decay: number,
  lowMileCap: number, spread: number, msrpNew: number,
  reliability: number, insurance: number, parts: number, maintenance: number, diy: number,
  issues: EncodedIssue[],
];

export type EncodedCatalog = { d: Dictionaries; r: EncodedRow[] };

/** Absent optional numbers encode as -1, which no real measurement can be. */
const ABSENT = -1;
const orNull = (n: number) => (n === ABSENT ? null : n);

export function decodeCatalog(enc: EncodedCatalog): Vehicle[] {
  const { d, r } = enc;

  return r.map((row): Vehicle => {
    const roles: Role[] = [];
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      if (row[7] & (1 << i)) roles.push(ROLE_ORDER[i]!);
    }

    const transmissions: Vehicle['spec']['transmissions'] = [];
    for (let i = 0; i < TRANS_ORDER.length; i++) {
      if (row[12] & (1 << i)) transmissions.push(TRANS_ORDER[i]!);
    }

    const knownIssues: Issue[] = row[36].map((e) => ({
      text: d.issueText[e[0]]!,
      onsetMiles: e[1],
      typicalCostUsd: e[2],
      severity: SEVERITY_ORDER[e[3]]!,
    }));

    return {
      id: row[0],
      make: d.make[row[1]]!,
      model: d.model[row[2]]!,
      generation: d.generation[row[3]]!,
      years: [row[4], row[5]],
      status: STATUS_ORDER[row[6]]!,
      roles,
      bodyStyle: d.body[row[8]] as Vehicle['bodyStyle'],
      spec: {
        seats: row[9],
        doors: row[10],
        drivetrain: d.drivetrain[row[11]] as Vehicle['spec']['drivetrain'],
        transmissions,
        cylinders: row[13],
        displacementL: row[14],
        aspiration: d.aspiration[row[15]] as Vehicle['spec']['aspiration'],
        horsepower: row[16],
        torqueLbFt: row[17],
        curbWeightLb: row[18],
        fuel: d.fuel[row[19]] as Vehicle['spec']['fuel'],
        mpgCombined: row[20],
        towingLb: orNull(row[21]),
        cargoCuFt: orNull(row[22]),
        groundClearanceIn: orNull(row[23]),
      },
      pricing: {
        base: row[24],
        baselineMiles: row[25],
        floor: row[26],
        decay: row[27],
        lowMileCap: row[28],
        spread: row[29],
        ...(row[30] > 0 ? { msrpNew: row[30] } : {}),
      },
      ownership: {
        reliabilityIndex: row[31],
        insuranceIndex: row[32],
        partsAvailability: row[33],
        annualMaintenanceUsd: row[34],
        diyFriendliness: row[35],
      },
      knownIssues,
    };
  });
}

/** Encoder. Lives beside the decoder so the format cannot drift. */
export function encodeCatalog(vehicles: Vehicle[]): EncodedCatalog {
  const d: Dictionaries = {
    make: [], model: [], generation: [], body: [],
    drivetrain: [], fuel: [], aspiration: [], issueText: [],
  };
  const intern = (list: string[], value: string) => {
    const i = list.indexOf(value);
    return i >= 0 ? i : list.push(value) - 1;
  };

  const r = vehicles.map((v): EncodedRow => {
    let rolesMask = 0;
    for (const role of v.roles) {
      const i = ROLE_ORDER.indexOf(role);
      if (i < 0) throw new Error(`${v.id}: unknown role ${role}`);
      rolesMask |= 1 << i;
    }

    let transMask = 0;
    for (const t of v.spec.transmissions) {
      const i = TRANS_ORDER.indexOf(t);
      if (i < 0) throw new Error(`${v.id}: unknown transmission ${t}`);
      transMask |= 1 << i;
    }

    const issues: EncodedIssue[] = v.knownIssues.map((issue) => [
      intern(d.issueText, issue.text),
      issue.onsetMiles,
      issue.typicalCostUsd,
      SEVERITY_ORDER.indexOf(issue.severity),
    ]);

    return [
      v.id, intern(d.make, v.make), intern(d.model, v.model), intern(d.generation, v.generation),
      v.years[0], v.years[1], STATUS_ORDER.indexOf(v.status), rolesMask, intern(d.body, v.bodyStyle),
      v.spec.seats, v.spec.doors, intern(d.drivetrain, v.spec.drivetrain), transMask,
      v.spec.cylinders, v.spec.displacementL, intern(d.aspiration, v.spec.aspiration),
      v.spec.horsepower, v.spec.torqueLbFt, v.spec.curbWeightLb, intern(d.fuel, v.spec.fuel),
      v.spec.mpgCombined,
      v.spec.towingLb ?? ABSENT, v.spec.cargoCuFt ?? ABSENT, v.spec.groundClearanceIn ?? ABSENT,
      v.pricing.base, v.pricing.baselineMiles, v.pricing.floor, v.pricing.decay,
      v.pricing.lowMileCap, v.pricing.spread, v.pricing.msrpNew ?? 0,
      v.ownership.reliabilityIndex, v.ownership.insuranceIndex, v.ownership.partsAvailability,
      v.ownership.annualMaintenanceUsd, v.ownership.diyFriendliness,
      issues,
    ];
  });

  return { d, r };
}
