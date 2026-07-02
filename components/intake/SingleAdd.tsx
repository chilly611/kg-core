"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson, sendJson } from "@/components/workspace/types";
import type { AddressDraft, Bundle, Proposal } from "@/lib/intake/types";

type Suggestion = { place_id: string; description: string };
type PlaceDetail = {
  place_id: string;
  formatted: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  postal: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  normalized: Record<string, unknown>;
};

// Path 3: one project + one address in a single step. Google Places
// type-ahead when the key exists; graceful manual fields (normalized NULL,
// TODO chip) when it doesn't.
export function SingleAdd({
  onProposal,
}: {
  onProposal: (bundle: Bundle, proposal: Proposal, startedAt: string) => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<PlaceDetail | null>(null);
  const [placesDown, setPlacesDown] = useState<boolean | null>(null);
  const [manual, setManual] = useState({ street: "", city: "", region: "", postal: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // One probe decides type-ahead vs fallback fields.
    getJson<{ fallback?: boolean; suggestions?: Suggestion[] }>("/api/places?q=probe")
      .then((r) => setPlacesDown(Boolean(r.fallback)))
      .catch(() => setPlacesDown(true));
  }, []);

  const search = useCallback((value: string) => {
    setQuery(value);
    setPicked(null);
    startedAtRef.current ??= new Date().toISOString();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await getJson<{ suggestions?: Suggestion[] }>(
          `/api/places?q=${encodeURIComponent(value)}`
        );
        setSuggestions(r.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }, []);

  const pick = useCallback(async (s: Suggestion) => {
    setSuggestions([]);
    setQuery(s.description);
    const r = await getJson<{ place: PlaceDetail }>(
      `/api/places?place_id=${encodeURIComponent(s.place_id)}`
    );
    setPicked(r.place);
  }, []);

  const preview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const address: AddressDraft = picked
        ? {
            key: "a1",
            raw_input: query,
            provider: "google_places",
            place_id: picked.place_id,
            street: picked.street,
            city: picked.city,
            region: picked.region,
            postal: picked.postal,
            country: picked.country,
            lat: picked.lat,
            lng: picked.lng,
            normalized: picked.normalized,
            verified: true,
          }
        : {
            key: "a1",
            raw_input: query || [manual.street, manual.city].filter(Boolean).join(", "),
            street: manual.street || null,
            city: manual.city || null,
            region: manual.region || null,
            postal: manual.postal || null,
            normalized: null, // TODO chip: normalize when GOOGLE_PLACES_KEY lands
          };
      const bundle: Bundle = {
        groups: [],
        addresses: [address],
        projects: [
          {
            key: "p1",
            name: projectName || picked?.street || manual.street || query,
            addressKey: "a1",
          },
        ],
        contacts: [],
        links: [],
      };
      const { proposal } = await sendJson<{ proposal: Proposal }>(
        "POST",
        "/api/intake/plan",
        { bundle, source: "places" }
      );
      onProposal(bundle, proposal, startedAtRef.current ?? new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }, [picked, query, manual, projectName, onProposal]);

  const canPreview =
    (projectName.trim() || query.trim() || manual.street.trim()) &&
    (picked || manual.street.trim() || manual.city.trim() || manual.region.trim() || manual.postal.trim());

  return (
    <div className="space-y-3">
      <input
        className="field w-full"
        placeholder="Project name (defaults to the street)"
        value={projectName}
        onChange={(e) => {
          startedAtRef.current ??= new Date().toISOString();
          setProjectName(e.target.value);
        }}
      />
      {placesDown === false ? (
        <div className="relative">
          <input
            className="field w-full"
            placeholder="Search an address…"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full border border-vellum bg-cream shadow">
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-parchment"
                    onClick={() => pick(s)}
                  >
                    {s.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked && (
            <p className="h-caption mt-1 text-sm">
              Verified: {picked.formatted} <span className="font-mono">({picked.place_id})</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {placesDown && (
            <span className="flag-chip flag-warn">
              TODO: normalization pending — GOOGLE_PLACES_KEY not set
            </span>
          )}
          <input
            className="field w-full"
            placeholder="Street (optional for concepts)"
            value={manual.street}
            onChange={(e) => {
              startedAtRef.current ??= new Date().toISOString();
              setManual({ ...manual, street: e.target.value });
            }}
          />
          <div className="flex gap-2">
            <input
              className="field flex-1"
              placeholder="City"
              value={manual.city}
              onChange={(e) => setManual({ ...manual, city: e.target.value })}
            />
            <input
              className="field w-20"
              placeholder="Region"
              value={manual.region}
              onChange={(e) => setManual({ ...manual, region: e.target.value })}
            />
            <input
              className="field w-24"
              placeholder="Postal"
              value={manual.postal}
              onChange={(e) => setManual({ ...manual, postal: e.target.value })}
            />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-rust">{error}</p>}
      <button className="btn" onClick={preview} disabled={busy || !canPreview}>
        {busy ? "Checking…" : "Preview"}
      </button>
    </div>
  );
}
