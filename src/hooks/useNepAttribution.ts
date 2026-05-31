'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Captures SkillHeed NEP partner attribution from the URL query string,
 * persists it across the session (cookie + sessionStorage), and exposes a
 * `track()` helper that posts events to the server-side logger.
 *
 * Query params: partner_id, source, level, state, district, campaign
 * Attribution is preserved for the configured window (default 30 days).
 */

export interface NepAttribution {
  partner_id: string | null;
  source: string | null;
  level: string | null;
  state: string | null;
  district: string | null;
  campaign: string | null;
  visitor_id: string;
}

const COOKIE_NAME = 'nep_attribution';
const STORAGE_KEY = 'nep_attribution';
const VISITOR_KEY = 'nep_visitor_id';
const ATTRIBUTION_DAYS = 30;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function useNepAttribution() {
  const [attribution, setAttribution] = useState<NepAttribution | null>(null);
  const trackedView = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const visitorId = getVisitorId();

    // Prefer fresh URL params; otherwise fall back to stored attribution.
    const fromUrl = {
      partner_id: params.get('partner_id'),
      source: params.get('source'),
      level: params.get('level'),
      state: params.get('state'),
      district: params.get('district'),
      campaign: params.get('campaign'),
    };

    const hasUrlAttribution = Object.values(fromUrl).some(Boolean);

    let resolved: NepAttribution;
    if (hasUrlAttribution) {
      resolved = { ...fromUrl, visitor_id: visitorId };
      const json = JSON.stringify(resolved);
      writeCookie(COOKIE_NAME, json, ATTRIBUTION_DAYS);
      window.sessionStorage.setItem(STORAGE_KEY, json);
    } else {
      const stored =
        window.sessionStorage.getItem(STORAGE_KEY) || readCookie(COOKIE_NAME);
      resolved = stored
        ? { ...(JSON.parse(stored) as NepAttribution), visitor_id: visitorId }
        : {
            partner_id: null,
            source: 'direct',
            level: null,
            state: null,
            district: null,
            campaign: null,
            visitor_id: visitorId,
          };
    }

    setAttribution(resolved);
  }, []);

  const track = useCallback(
    async (eventType: string, extra: Record<string, unknown> = {}) => {
      if (!attribution) return;
      try {
        await fetch('/api/nep/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType,
            partnerId: attribution.partner_id,
            source: attribution.source,
            level: attribution.level,
            state: attribution.state,
            district: attribution.district,
            campaign: attribution.campaign,
            visitorId: attribution.visitor_id,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            ...extra,
          }),
        });
      } catch (e) {
        console.log('[v0] NEP track failed', e);
      }
    },
    [attribution]
  );

  // Fire page_view + unique_visit once attribution is resolved.
  useEffect(() => {
    if (!attribution || trackedView.current) return;
    trackedView.current = true;
    track('page_view');
    const seenKey = `nep_seen_${attribution.partner_id || 'direct'}`;
    if (!window.localStorage.getItem(seenKey)) {
      window.localStorage.setItem(seenKey, '1');
      track('unique_visit');
    }
  }, [attribution, track]);

  return { attribution, track };
}
