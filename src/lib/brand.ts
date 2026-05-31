/**
 * Central branding constants for SkillHeed NEP Partner.
 *
 * Keep all visible product naming here so the app can be rebranded from a
 * single place. Database-stored ProgramSettings.companyName still overrides
 * these where a per-program brand is configured.
 */
export const BRAND = {
  /** Full product name */
  name: 'SkillHeed NEP Partner',
  /** Short name used in compact UI (sidebars, logos, headers) */
  shortName: 'SkillHeed NEP',
  /** Company / org name used in emails and footers */
  company: 'SkillHeed',
  /** One-line tagline */
  tagline: 'NEP-aligned Partner & School Onboarding Platform',
  /** Marketing/landing description for SEO */
  description:
    'SkillHeed NEP Partner helps Master Partners, Sub Partners, and Partners onboard schools and associations across National, State, and District levels with full referral tracking and analytics.',
} as const;

export type Brand = typeof BRAND;
