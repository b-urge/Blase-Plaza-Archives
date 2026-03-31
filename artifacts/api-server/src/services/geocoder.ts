import { logger } from "../lib/logger";

export interface GeoResult {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  try {
    const encoded = encodeURIComponent(address + ", Miami-Dade County, Florida");
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "BlasePlazaArchives/1.0 (miami-dade-survey-database)" },
    });
    if (!resp.ok) return null;
    const data = await resp.json() as Array<{ lat: string; lon: string }>;
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    logger.warn({ err, address }, "Geocoding failed");
    return null;
  }
}
