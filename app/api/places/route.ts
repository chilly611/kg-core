import { authed } from "@/lib/server/api";

// Google Places proxy (key stays server-side).
//   ?q=...        -> autocomplete suggestions
//   ?place_id=... -> normalized address parts + full payload
// No GOOGLE_PLACES_KEY -> { fallback: true } and the UI degrades to plain
// address fields (normalized stays NULL, flagged with a TODO chip).

type Component = { types: string[]; longText?: string; shortText?: string };

function part(components: Component[], type: string, short = false): string | null {
  const c = components.find((x) => x.types.includes(type));
  return (short ? c?.shortText : c?.longText) ?? null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const placeId = url.searchParams.get("place_id");
  const key = process.env.GOOGLE_PLACES_KEY;

  return authed(async () => {
    if (!key) return { fallback: true };

    if (placeId) {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
          },
        }
      );
      if (!res.ok) throw new Error(`Places details failed (${res.status})`);
      const detail = await res.json();
      const components: Component[] = detail.addressComponents ?? [];
      const streetNumber = part(components, "street_number");
      const route = part(components, "route");
      return {
        place: {
          place_id: detail.id,
          formatted: detail.formattedAddress ?? null,
          street: [streetNumber, route].filter(Boolean).join(" ") || null,
          city:
            part(components, "locality") ?? part(components, "postal_town") ?? null,
          region: part(components, "administrative_area_level_1", true),
          postal: part(components, "postal_code"),
          country: part(components, "country", true),
          lat: detail.location?.latitude ?? null,
          lng: detail.location?.longitude ?? null,
          normalized: detail,
        },
      };
    }

    if (q) {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({ input: q }),
      });
      if (!res.ok) throw new Error(`Places autocomplete failed (${res.status})`);
      const data = await res.json();
      type Suggestion = {
        placePrediction?: { placeId: string; text?: { text?: string } };
      };
      return {
        suggestions: ((data.suggestions ?? []) as Suggestion[])
          .filter((s) => s.placePrediction)
          .map((s) => ({
            place_id: s.placePrediction!.placeId,
            description: s.placePrediction!.text?.text ?? "",
          })),
      };
    }

    throw new Error("Pass ?q= or ?place_id=");
  });
}
