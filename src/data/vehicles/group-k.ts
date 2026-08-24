/**
 * Wave 2 addendum: the cheap end of family and cargo.
 *
 * Added because coverage checks found the family and off-road roles had
 * nothing at all under $12,000. Someone with a small budget who needs to move
 * people, or who wants a cheap 4x4, is exactly the person this tool should
 * serve, and the catalog was failing both of them.
 */
export const groupK: unknown[] = [
  {
    id: 'jeep-cherokee-xj', make: 'Jeep', model: 'Cherokee', generation: 'XJ',
    years: [1990, 2001], status: 'discontinued',
    roles: ['offroad', 'project', 'winter', 'cargo'], bodyStyle: 'suv',
    spec: { seats: 5, doors: 5, drivetrain: '4WD', transmissions: ['manual', 'automatic'],
      cylinders: 6, displacementL: 4.0, aspiration: 'na', horsepower: 190, torqueLbFt: 225,
      curbWeightLb: 3200, fuel: 'gas', mpgCombined: 17, towingLb: 5000, cargoCuFt: 71.0, groundClearanceIn: 8.2 },
    pricing: { base: 9500, baselineMiles: 165000, floor: 2600, decay: 0.05, spread: 0.34 },
    ownership: { reliabilityIndex: 4, insuranceIndex: 2, partsAvailability: 5, annualMaintenanceUsd: 1000, diyFriendliness: 5 },
    notes: {
      summary: 'Solid axles, a unibody, and the 4.0 straight six that refuses to die. The default cheap 4x4 and the reason so many people started wrenching.',
      knownIssues: [
        { text: 'Rust in the rear quarters, floor pans and unibody frame rails', onsetMiles: 160000, typicalCostUsd: 3000, severity: 'car-ending' },
        { text: 'Rear main seal and valve cover leaks are near universal', onsetMiles: 150000, typicalCostUsd: 900, severity: 'annoyance' },
        { text: 'Cooling system and radiator failures, the 4.0 dislikes overheating', onsetMiles: 150000, typicalCostUsd: 700, severity: 'expensive' },
      ],
      whatToLookFor: ['Unibody rail and floor condition, which decides the purchase', 'NP242 Selec-Trac transfer case for a full-time option', 'Manual gearbox with the AX-15 rather than the weaker AX-5'],
    },
  },
  {
    id: 'ford-ranger-3rd', make: 'Ford', model: 'Ranger', generation: 'third gen',
    years: [1998, 2011], status: 'discontinued',
    roles: ['offroad', 'cargo', 'project', 'tow'], bodyStyle: 'truck',
    spec: { seats: 4, doors: 4, drivetrain: '4WD', transmissions: ['manual', 'automatic'],
      cylinders: 6, displacementL: 4.0, aspiration: 'na', horsepower: 207, torqueLbFt: 238,
      curbWeightLb: 3900, fuel: 'gas', mpgCombined: 17, towingLb: 5800, cargoCuFt: 0, groundClearanceIn: 8.0 },
    pricing: { base: 8500, baselineMiles: 160000, floor: 2800, decay: 0.055, spread: 0.3 },
    ownership: { reliabilityIndex: 4, insuranceIndex: 2, partsAvailability: 5, annualMaintenanceUsd: 900, diyFriendliness: 5 },
    notes: {
      summary: 'A small simple truck with a proper low range and parts at every store. The cheapest way into a usable 4x4 pickup.',
      knownIssues: [
        { text: 'Frame and cab mount corrosion on salted-road trucks', onsetMiles: 160000, typicalCostUsd: 2800, severity: 'car-ending' },
        { text: 'Timing chain guides on the 4.0 SOHC wear and rattle', onsetMiles: 170000, typicalCostUsd: 2400, severity: 'expensive' },
      ],
      whatToLookFor: ['4.0 SOHC over the 3.0 Vulcan, which is gutless', 'FX4 trim for the off-road dampers and skid plates', 'Southern trucks for frame condition'],
    },
  },
  {
    id: 'nissan-pathfinder-r50', make: 'Nissan', model: 'Pathfinder', generation: 'R50',
    years: [1996, 2004], status: 'discontinued',
    roles: ['offroad', 'project', 'winter'], bodyStyle: 'suv',
    spec: { seats: 5, doors: 5, drivetrain: '4WD', transmissions: ['manual', 'automatic'],
      cylinders: 6, displacementL: 3.5, aspiration: 'na', horsepower: 240, torqueLbFt: 265,
      curbWeightLb: 4000, fuel: 'gas', mpgCombined: 16, towingLb: 5000, cargoCuFt: 85.0, groundClearanceIn: 8.3 },
    pricing: { base: 7500, baselineMiles: 170000, floor: 2400, decay: 0.055, spread: 0.32 },
    ownership: { reliabilityIndex: 3, insuranceIndex: 2, partsAvailability: 3, annualMaintenanceUsd: 1000, diyFriendliness: 4 },
    notes: {
      summary: 'A properly capable 4x4 with an independent front end and the durable VQ35. Overlooked, and cheap because of it.',
      knownIssues: [
        { text: 'Rust in the rear arches, sills and subframe on salted-road cars', onsetMiles: 170000, typicalCostUsd: 2400, severity: 'car-ending' },
        { text: 'Timing chain guide wear on higher mileage VQ engines', onsetMiles: 180000, typicalCostUsd: 2200, severity: 'expensive' },
      ],
      whatToLookFor: ['2001 and later for the VQ35DE and the facelift', 'Manual gearbox cars, uncommon and durable', 'Southern cars for structural condition'],
    },
  },
  {
    id: 'toyota-sienna-xl20', make: 'Toyota', model: 'Sienna', generation: 'XL20',
    years: [2004, 2010], status: 'discontinued',
    roles: ['family', 'cargo', 'winter'], bodyStyle: 'van',
    spec: { seats: 8, doors: 5, drivetrain: 'AWD', transmissions: ['automatic'],
      cylinders: 6, displacementL: 3.5, aspiration: 'na', horsepower: 266, torqueLbFt: 245,
      curbWeightLb: 4365, fuel: 'gas', mpgCombined: 19, towingLb: 3500, cargoCuFt: 43.6, groundClearanceIn: 6.3 },
    pricing: { base: 8500, baselineMiles: 165000, floor: 2800, decay: 0.06, spread: 0.26 },
    ownership: { reliabilityIndex: 5, insuranceIndex: 2, partsAvailability: 5, annualMaintenanceUsd: 850, diyFriendliness: 3 },
    notes: {
      summary: 'Eight seats, available all wheel drive, and Toyota running gear, for the price of a decent motorcycle.',
      knownIssues: [
        { text: 'Power sliding door motors and cables fail', onsetMiles: 130000, typicalCostUsd: 900, severity: 'annoyance' },
        { text: 'Oil sludge on early 3.3 engines that missed oil changes', onsetMiles: 150000, typicalCostUsd: 3500, severity: 'car-ending' },
        { text: 'Rear suspension and subframe corrosion on salted-road cars', onsetMiles: 170000, typicalCostUsd: 1800, severity: 'expensive' },
      ],
      whatToLookFor: ['2007 and later for the 3.5 engine and five-speed', 'AWD models, rare and the only minivan offering it then', 'Documented oil change history'],
    },
  },
  {
    id: 'honda-odyssey-rl3', make: 'Honda', model: 'Odyssey', generation: 'RL3',
    years: [2005, 2010], status: 'discontinued',
    roles: ['family', 'cargo'], bodyStyle: 'van',
    spec: { seats: 8, doors: 5, drivetrain: 'FWD', transmissions: ['automatic'],
      cylinders: 6, displacementL: 3.5, aspiration: 'na', horsepower: 244, torqueLbFt: 240,
      curbWeightLb: 4400, fuel: 'gas', mpgCombined: 20, towingLb: 3500, cargoCuFt: 38.4, groundClearanceIn: 4.7 },
    pricing: { base: 7000, baselineMiles: 165000, floor: 2200, decay: 0.075, spread: 0.28 },
    ownership: { reliabilityIndex: 3, insuranceIndex: 2, partsAvailability: 5, annualMaintenanceUsd: 1100, diyFriendliness: 3 },
    notes: {
      summary: 'The cheapest way to move eight people, and it drives better than any of its rivals. The transmission is the gamble.',
      knownIssues: [
        { text: 'Transmission failure is the defining problem of this generation', onsetMiles: 140000, typicalCostUsd: 3200, severity: 'car-ending' },
        { text: 'Variable cylinder management fouls plugs and burns oil', onsetMiles: 130000, typicalCostUsd: 1400, severity: 'expensive' },
      ],
      whatToLookFor: ['Documented transmission fluid changes every 30,000 miles', 'A VCM disable module already fitted', 'EX-L for the leather and power doors'],
    },
  },
  {
    id: 'dodge-grand-caravan-rt', make: 'Dodge', model: 'Grand Caravan', generation: 'RT',
    years: [2011, 2020], status: 'discontinued',
    roles: ['family', 'cargo'], bodyStyle: 'van',
    spec: { seats: 7, doors: 5, drivetrain: 'FWD', transmissions: ['automatic'],
      cylinders: 6, displacementL: 3.6, aspiration: 'na', horsepower: 283, torqueLbFt: 260,
      curbWeightLb: 4321, fuel: 'gas', mpgCombined: 20, towingLb: 3600, cargoCuFt: 33.0, groundClearanceIn: 5.2 },
    pricing: { base: 9000, baselineMiles: 130000, floor: 2600, decay: 0.10, spread: 0.26 },
    ownership: { reliabilityIndex: 2, insuranceIndex: 2, partsAvailability: 5, annualMaintenanceUsd: 1200, diyFriendliness: 4 },
    notes: {
      summary: 'Stow and Go seats that fold into the floor, for less than a used hatchback. It is cheap because it is not durable.',
      knownIssues: [
        { text: 'TIPM electrical module faults cause a wide range of symptoms', onsetMiles: 110000, typicalCostUsd: 1200, severity: 'expensive' },
        { text: 'Transmission and torque converter shudder', onsetMiles: 130000, typicalCostUsd: 2800, severity: 'expensive' },
        { text: 'Pentastar cylinder head failure on 2011 to 2013 engines', onsetMiles: 100000, typicalCostUsd: 2600, severity: 'expensive' },
      ],
      whatToLookFor: ['2014 and later for the revised cylinder head', 'Stow and Go seating, which no rival offers', 'TIPM already replaced with the updated part'],
    },
  },
  {
    id: 'mazda5-cw', make: 'Mazda', model: 'Mazda5', generation: 'CW',
    years: [2012, 2015], status: 'discontinued',
    roles: ['family', 'cargo', 'commuter'], bodyStyle: 'van',
    spec: { seats: 6, doors: 5, drivetrain: 'FWD', transmissions: ['manual', 'automatic'],
      cylinders: 4, displacementL: 2.5, aspiration: 'na', horsepower: 157, torqueLbFt: 163,
      curbWeightLb: 3417, fuel: 'gas', mpgCombined: 24, towingLb: null, cargoCuFt: 44.4, groundClearanceIn: 5.5 },
    pricing: { base: 8000, baselineMiles: 130000, floor: 2800, decay: 0.075, spread: 0.24 },
    ownership: { reliabilityIndex: 4, insuranceIndex: 2, partsAvailability: 3, annualMaintenanceUsd: 800, diyFriendliness: 4 },
    notes: {
      summary: 'Six seats and sliding doors in something the size of a hatchback. A manual gearbox was offered, which is almost absurd.',
      knownIssues: [
        { text: 'Rear wheel arch and sill corrosion on salted-road cars', onsetMiles: 130000, typicalCostUsd: 1800, severity: 'expensive' },
        { text: 'Third row is genuinely small and best for children', onsetMiles: 0, typicalCostUsd: 0, severity: 'annoyance' },
      ],
      whatToLookFor: ['Manual gearbox cars, rare and enjoyable', 'Sliding doors operating smoothly on their tracks', 'Southern cars for rust'],
    },
  },
  {
    id: 'ford-taurus-x', make: 'Ford', model: 'Taurus X', generation: 'D258',
    years: [2008, 2009], status: 'discontinued',
    roles: ['family', 'cargo', 'winter'], bodyStyle: 'wagon',
    spec: { seats: 7, doors: 5, drivetrain: 'AWD', transmissions: ['automatic'],
      cylinders: 6, displacementL: 3.5, aspiration: 'na', horsepower: 263, torqueLbFt: 249,
      curbWeightLb: 4400, fuel: 'gas', mpgCombined: 18, towingLb: 2000, cargoCuFt: 46.2, groundClearanceIn: 6.0 },
    pricing: { base: 6500, baselineMiles: 150000, floor: 2200, decay: 0.075, spread: 0.3 },
    ownership: { reliabilityIndex: 3, insuranceIndex: 2, partsAvailability: 4, annualMaintenanceUsd: 950, diyFriendliness: 4 },
    notes: {
      summary: 'A seven seat all wheel drive wagon that nobody bought and nobody remembers. Enormous inside for the money.',
      knownIssues: [
        { text: 'Power transfer unit and rear differential wear on AWD cars', onsetMiles: 140000, typicalCostUsd: 2200, severity: 'expensive' },
        { text: 'Throttle body electronic faults cause limp mode', onsetMiles: 130000, typicalCostUsd: 600, severity: 'annoyance' },
      ],
      whatToLookFor: ['AWD models with documented PTU fluid service', 'Eddie Bauer or Limited trims for the better interior', 'Rust in the rear arches and tailgate'],
    },
  },
  {
    id: 'kia-sedona-yp', make: 'Kia', model: 'Sedona', generation: 'YP',
    years: [2015, 2021], status: 'discontinued',
    roles: ['family', 'cargo'], bodyStyle: 'van',
    spec: { seats: 8, doors: 5, drivetrain: 'FWD', transmissions: ['automatic'],
      cylinders: 6, displacementL: 3.3, aspiration: 'na', horsepower: 276, torqueLbFt: 248,
      curbWeightLb: 4411, fuel: 'gas', mpgCombined: 21, towingLb: 3500, cargoCuFt: 33.9, groundClearanceIn: 6.4 },
    pricing: { base: 13000, baselineMiles: 105000, floor: 4200, decay: 0.085, spread: 0.2 },
    ownership: { reliabilityIndex: 3, insuranceIndex: 2, partsAvailability: 4, annualMaintenanceUsd: 900, diyFriendliness: 3 },
    notes: {
      summary: 'The forgotten minivan, and the cheapest way into a modern one with a long warranty behind it.',
      knownIssues: [
        { text: 'Power sliding door and tailgate motor faults', onsetMiles: 100000, typicalCostUsd: 900, severity: 'annoyance' },
        { text: 'Lambda V6 oil consumption on some engines', onsetMiles: 110000, typicalCostUsd: 2600, severity: 'expensive' },
      ],
      whatToLookFor: ['SX and above for the better seats and equipment', 'Remaining powertrain warranty, originally ten years', 'Second row Slide-N-Stow seats'],
    },
  },
];
