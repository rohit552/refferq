/**
 * SkillHeed NEP Partner hierarchy.
 *
 * This layers a 3-tier partner hierarchy on top of the existing data model
 * WITHOUT any schema migration:
 *   - User.role        -> ADMIN (Master Partner / platform) | ASSOCIATION (partners)
 *   - PartnerGroup.name -> used to label a partner's tier ("Master Partner", etc.)
 *   - Association / School Lead metadata JSON -> stores level/state/district attribution
 *
 * Operational levels map 1:1 to partner tiers:
 *   Master Partner -> National Level
 *   Sub Partner    -> State Level
 *   Partner        -> District Level
 */

export type PartnerTier = 'MASTER' | 'SUB' | 'PARTNER';
export type OperationalLevel = 'NATIONAL' | 'STATE' | 'DISTRICT';

export interface PartnerTierMeta {
  tier: PartnerTier;
  label: string;
  level: OperationalLevel;
  levelLabel: string;
  /** Higher rank = broader visibility */
  rank: number;
  description: string;
}

export const PARTNER_TIERS: Record<PartnerTier, PartnerTierMeta> = {
  MASTER: {
    tier: 'MASTER',
    label: 'Master Partner',
    level: 'NATIONAL',
    levelLabel: 'National Level',
    rank: 3,
    description: 'Full visibility across all states, districts and partners.',
  },
  SUB: {
    tier: 'SUB',
    label: 'Sub Partner',
    level: 'STATE',
    levelLabel: 'State Level',
    rank: 2,
    description: 'Manages assigned states/districts and their partners.',
  },
  PARTNER: {
    tier: 'PARTNER',
    label: 'Partner',
    level: 'DISTRICT',
    levelLabel: 'District Level',
    rank: 1,
    description: 'Manages own leads, schools, and tracking only.',
  },
};

export const ASSOCIATION_LEVELS = [
  { value: 'NATIONAL', label: 'National Association' },
  { value: 'STATE', label: 'State Association' },
  { value: 'DISTRICT', label: 'District Association' },
] as const;

/** Resolve a partner tier from a PartnerGroup name (case-insensitive). */
export function tierFromGroupName(groupName?: string | null): PartnerTier {
  const n = (groupName || '').toLowerCase();
  if (n.includes('master')) return 'MASTER';
  if (n.includes('sub')) return 'SUB';
  return 'PARTNER';
}

export function levelFromTier(tier: PartnerTier): OperationalLevel {
  return PARTNER_TIERS[tier].level;
}

export function tierFromLevel(level: OperationalLevel): PartnerTier {
  return (Object.values(PARTNER_TIERS).find((t) => t.level === level) || PARTNER_TIERS.PARTNER).tier;
}

/**
 * Permission helper: can a viewer (with a given tier) see data owned by a target tier?
 * Master sees everything; Sub sees Sub + Partner; Partner sees only own.
 */
export function canViewTier(viewer: PartnerTier, target: PartnerTier): boolean {
  return PARTNER_TIERS[viewer].rank >= PARTNER_TIERS[target].rank;
}

export interface PartnerScope {
  tier: PartnerTier;
  states: string[];
  districts: string[];
}

/**
 * Determine whether a partner scope grants access to a given state/district.
 * - MASTER: always true (national).
 * - SUB: true if state is in assigned states (district optional).
 * - PARTNER: true only if district matches an assigned district.
 */
export function isInScope(
  scope: PartnerScope,
  target: { state?: string | null; district?: string | null }
): boolean {
  if (scope.tier === 'MASTER') return true;
  const state = (target.state || '').toLowerCase();
  const district = (target.district || '').toLowerCase();

  if (scope.tier === 'SUB') {
    return scope.states.map((s) => s.toLowerCase()).includes(state);
  }
  // PARTNER
  return scope.districts.map((d) => d.toLowerCase()).includes(district);
}

/** Default level mapping config used by admin settings. */
export const DEFAULT_LEVEL_MAPPING = {
  'Master Partner': 'NATIONAL',
  'Sub Partner': 'STATE',
  Partner: 'DISTRICT',
} as const;

/** Default attribution window (days) for school-lead tracking on /nep. */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;
