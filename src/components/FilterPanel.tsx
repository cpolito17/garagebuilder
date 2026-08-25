import { useMemo, useState } from 'react';
import { CaretDown, ArrowClockwise } from '@phosphor-icons/react';
import { CATALOG } from '../data/catalog';
import type { Role } from '../data/types';
import { DEFAULT_FILTERS, ROLE_PRESETS, findMatches, type Filters } from '../lib/matching';
import { CURRENT_YEAR } from '../lib/pricing';

/**
 * The full filter set. docs/SPEC.md section 4.4.
 *
 * Role presets are shown pre-applied and stay editable. A preset the user
 * cannot see and adjust is a black box, and a black box in a tool that quotes
 * prices is a trust problem.
 *
 * Each option carries the result count it would produce, so nobody filters
 * themselves into an empty list blind.
 */

const TRANSMISSIONS = [
  ['manual', 'Manual'], ['automatic', 'Automatic'], ['dct', 'DCT'], ['cvt', 'CVT'],
  ['single-speed', 'Single-speed'],
] as const;

const DRIVETRAINS = [['FWD', 'FWD'], ['RWD', 'RWD'], ['AWD', 'AWD'], ['4WD', '4WD']] as const;

const BODY_STYLES = [
  ['coupe', 'Coupe'], ['sedan', 'Sedan'], ['hatchback', 'Hatch'], ['wagon', 'Wagon'],
  ['convertible', 'Convertible'], ['targa', 'Targa'], ['suv', 'SUV'], ['truck', 'Truck'], ['van', 'Van'],
] as const;

const FUELS = [
  ['gas', 'Petrol'], ['diesel', 'Diesel'], ['hybrid', 'Hybrid'], ['phev', 'PHEV'], ['ev', 'Electric'],
] as const;

const SEATS = [0, 2, 4, 5, 6, 7];
const TOWING = [0, 3500, 5000, 7000, 10000];

export function FilterPanel({
  filters, role, budget, odometer, onChange,
}: {
  filters: Filters;
  role: Role | null;
  budget: number;
  odometer: number;
  onChange: (f: Filters) => void;
}) {
  const [open, setOpen] = useState(false);

  const preset = role ? ROLE_PRESETS[role] ?? {} : {};
  const presetKeys = Object.keys(preset) as (keyof Filters)[];

  /** Result count if one field were changed, so the impact is visible first. */
  const countWith = useMemo(
    () => (patch: Partial<Filters>) =>
      findMatches(CATALOG, { budget, role, odometer, filters: { ...filters, ...patch } }).matches.length,
    [budget, role, odometer, filters],
  );

  const changed = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).filter((k) => {
    const base = { ...DEFAULT_FILTERS, ...preset };
    return JSON.stringify(filters[k]) !== JSON.stringify(base[k]);
  }).length;

  const toggle = <K extends 'transmissions' | 'drivetrains' | 'bodyStyles' | 'fuels'>(key: K, value: string) => {
    const list = filters[key];
    onChange({
      ...filters,
      [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 items-center justify-between gap-2 rounded-[10px] border border-[--hairline] bg-[--bg-shell] px-3 t-small text-[--text-primary]"
      >
        <span>
          Filters
          {changed > 0 && (
            <span className="num text-[--text-tertiary]"> · {changed} changed</span>
          )}
          {presetKeys.length > 0 && changed === 0 && (
            <span className="t-small text-[--text-tertiary]"> · role defaults applied</span>
          )}
        </span>
        <CaretDown
          size={14}
          className="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-4 rounded-[10px] border border-[--hairline] p-3">
          {presetKeys.length > 0 && (
            <p className="m-0 t-small text-[--text-tertiary]">
              The role set these defaults. Every one of them is editable.
            </p>
          )}

          <Group label="Transmission">
            {TRANSMISSIONS.map(([v, l]) => (
              <Toggle
                key={v} label={l}
                on={filters.transmissions.includes(v)}
                count={countWith({
                  transmissions: filters.transmissions.includes(v)
                    ? filters.transmissions.filter((x) => x !== v)
                    : [...filters.transmissions, v],
                })}
                onClick={() => toggle('transmissions', v)}
              />
            ))}
          </Group>

          <Group label="Drivetrain">
            {DRIVETRAINS.map(([v, l]) => (
              <Toggle
                key={v} label={l}
                on={filters.drivetrains.includes(v)}
                count={countWith({
                  drivetrains: filters.drivetrains.includes(v)
                    ? filters.drivetrains.filter((x) => x !== v)
                    : [...filters.drivetrains, v],
                })}
                onClick={() => toggle('drivetrains', v)}
              />
            ))}
          </Group>

          <Group label="Body">
            {BODY_STYLES.map(([v, l]) => (
              <Toggle
                key={v} label={l}
                on={filters.bodyStyles.includes(v)}
                count={countWith({
                  bodyStyles: filters.bodyStyles.includes(v)
                    ? filters.bodyStyles.filter((x) => x !== v)
                    : [...filters.bodyStyles, v],
                })}
                onClick={() => toggle('bodyStyles', v)}
              />
            ))}
          </Group>

          <Group label="Fuel">
            {FUELS.map(([v, l]) => (
              <Toggle
                key={v} label={l}
                on={filters.fuels.includes(v)}
                count={countWith({
                  fuels: filters.fuels.includes(v)
                    ? filters.fuels.filter((x) => x !== v)
                    : [...filters.fuels, v],
                })}
                onClick={() => toggle('fuels', v)}
              />
            ))}
          </Group>

          <Group label="Minimum seats">
            {SEATS.map((n) => (
              <Toggle
                key={n} label={n === 0 ? 'Any' : n === 7 ? '7+' : String(n)}
                on={filters.minSeats === n}
                count={countWith({ minSeats: n })}
                onClick={() => onChange({ ...filters, minSeats: n })}
              />
            ))}
          </Group>

          <Group label="Minimum towing">
            {TOWING.map((n) => (
              <Toggle
                key={n} label={n === 0 ? 'Any' : `${(n / 1000).toFixed(1).replace('.0', '')}k lb`}
                on={filters.minTowingLb === n}
                count={countWith({ minTowingLb: n })}
                onClick={() => onChange({ ...filters, minTowingLb: n })}
              />
            ))}
          </Group>

          <Slider
            label="Generation starts in or after"
            value={filters.minYear}
            min={1990} max={CURRENT_YEAR} step={1}
            format={(v) => String(v)}
            onChange={(v) => onChange({ ...filters, minYear: v })}
          />

          <Slider
            label="Minimum cargo space"
            value={filters.minCargoCuFt}
            min={0} max={150} step={5}
            format={(v) => v === 0 ? 'Any' : `${v} cu ft`}
            onChange={(v) => onChange({ ...filters, minCargoCuFt: v })}
          />

          <Slider
            label="Minimum ground clearance"
            value={filters.minGroundClearanceIn}
            min={0} max={12} step={0.5}
            format={(v) => v === 0 ? 'Any' : `${v.toFixed(1)} in`}
            onChange={(v) => onChange({ ...filters, minGroundClearanceIn: v })}
          />

          <Slider
            label="Minimum reliability"
            value={filters.minReliability}
            min={1} max={5} step={1}
            format={(v) => `${v} of 5`}
            onChange={(v) => onChange({ ...filters, minReliability: v })}
          />

          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, ...preset })}
            className="group inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[--hairline] bg-[--bg-shell] px-4 t-small text-[--text-primary]"
          >
            <ArrowClockwise size={14} />
            Reset to role defaults
          </button>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="t-label p-0 text-[--text-tertiary]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Toggle({
  label, on, count, onClick,
}: { label: string; on: boolean; count: number; onClick: () => void }) {
  const dead = count === 0 && !on;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={`${count} ${count === 1 ? 'match' : 'matches'}`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 t-small transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
      style={{
        background: on ? 'var(--accent)' : 'var(--bg-surface)',
        color: on ? 'var(--accent-on)' : dead ? 'var(--text-tertiary)' : 'var(--text-primary)',
        borderColor: on ? 'var(--accent)' : 'var(--hairline)',
        opacity: dead ? 0.55 : 1,
      }}
    >
      {label}
      <span className="num" style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}

function Slider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="t-label text-[--text-tertiary]">{label}</span>
        <span className="num t-small text-[--text-secondary]">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer"
        style={{ accentColor: 'var(--accent)' }}
      />
    </label>
  );
}
