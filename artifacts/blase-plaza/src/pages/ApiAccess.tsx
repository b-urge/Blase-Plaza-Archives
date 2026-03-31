import React, { useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ApiAccess() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const apiBase = `${origin}${BASE}/api/v1/`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !intendedUse.trim()) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/keys/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: name, email, intendedUse }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Key generation failed.");
      } else {
        setGeneratedKey(data.key);
        setName("");
        setEmail("");
        setIntendedUse("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="win98-window p-4 max-w-3xl">
      <h2
        className="text-lg font-bold mb-1 pb-2 border-b-2 border-[#808080] uppercase tracking-widest"
        style={{ fontFamily: "Verdana, Arial, sans-serif" }}
      >
        API ACCESS
      </h2>

      {/* Section 1 — About */}
      <div className="mt-4 mb-6">
        <p className="font-bold text-sm mb-2 uppercase tracking-wide">
          BLASÉ PLAZA ARCHIVES — DATA ACCESS API
        </p>
        <p className="text-xs text-gray-700 mb-4">Miami-Dade County Field Survey Database</p>

        <p className="text-sm mb-3">
          This API provides programmatic read-only access to the Blasé Plaza Archives survey
          database. All records reflect permit data sourced from Miami-Dade County open data systems
          and AI-generated field assessments based on documentary evidence available at time of
          survey.
        </p>
        <p className="text-sm mb-3">
          Access is free. An API key is required for all requests.
        </p>

        <div
          className="text-sm p-3 border border-[#808080] bg-[#f0ede8] mb-3"
          style={{ fontFamily: "Courier New, monospace" }}
        >
          <p className="mb-1">Base URL: {apiBase}</p>
          <p className="mb-1">Authentication: Include your key in the request header:</p>
          <p className="mb-1 pl-4">X-BPA-API-Key: YOUR-KEY-HERE</p>
          <p className="mb-1">Rate limit: 100 requests per day per key.</p>
        </div>

        <p className="text-sm">
          Data is updated daily. Records reflect permit status as of the most recent sync.
        </p>
      </div>

      <hr className="border-black mb-6" />

      {/* Section 2 — Request Key Form */}
      <div className="mb-6">
        <p className="font-bold text-sm mb-4 uppercase tracking-wide">REQUEST AN API KEY</p>

        {generatedKey ? (
          <div
            className="p-4 border-2 border-black text-sm leading-relaxed"
            style={{ background: "#f5f0e8", fontFamily: "Courier New, monospace" }}
          >
            <p className="font-bold mb-3">ACCESS GRANTED</p>
            <p className="mb-3">
              Your API key has been generated. Store it securely — it will not be displayed again.
            </p>
            <p className="font-bold mb-1">YOUR KEY:</p>
            <p className="mb-3 text-base tracking-wider bg-white border border-[#808080] px-2 py-1 inline-block">
              {generatedKey}
            </p>
            <p className="mb-1">Include this key in all requests as a header:</p>
            <p className="mb-3 pl-4">X-BPA-API-Key: {generatedKey}</p>
            <p className="mb-1">Rate limit: 100 requests per day.</p>
            <p className="mb-1">Base URL: {apiBase}</p>
            <p className="mt-3">Questions or issues: contact the archive administrator.</p>
            <div className="mt-4">
              <button
                className="win98-btn text-sm px-3 py-1"
                onClick={() => setGeneratedKey(null)}
              >
                [ REQUEST ANOTHER KEY ]
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">YOUR NAME:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm"
                style={{ borderStyle: "inset" }}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">EMAIL ADDRESS:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm"
                style={{ borderStyle: "inset" }}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">INTENDED USE:</label>
              <textarea
                value={intendedUse}
                onChange={(e) => setIntendedUse(e.target.value)}
                rows={4}
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm resize-none"
                style={{ borderStyle: "inset" }}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-red-700 font-bold border border-red-400 bg-red-50 px-2 py-1">
                {error}
              </p>
            )}
            <div>
              <button type="submit" className="win98-btn text-sm px-4 py-1" disabled={loading}>
                {loading ? "[ PROCESSING... ]" : "[ REQUEST ACCESS KEY ]"}
              </button>
            </div>
          </form>
        )}
      </div>

      <hr className="border-black mb-6" />

      {/* Section 3 — Documentation */}
      <div
        className="text-sm leading-relaxed"
        style={{ fontFamily: "Courier New, monospace" }}
      >
        <p className="font-bold mb-3 uppercase tracking-wide" style={{ fontFamily: "Verdana, Arial, sans-serif" }}>
          API DOCUMENTATION
        </p>

        <p className="font-bold mb-2">ENDPOINTS</p>
        <p className="mb-1">GET /api/v1/plazas</p>
        <p className="mb-1 pl-4">Returns all plaza records. Optional query parameters:</p>
        <p className="mb-1 pl-8">?horizon=IMMINENT|NEAR-TERM|PROJECTED|EXPIRED</p>
        <p className="mb-1 pl-8">?classification=[plaza type]</p>
        <p className="mb-1 pl-8">?limit=[integer, max 100]</p>
        <p className="mb-1 pl-8">?offset=[integer, for pagination]</p>

        <p className="mt-3 mb-1">GET /api/v1/plazas/:site_id</p>
        <p className="mb-1 pl-4">Returns a single plaza record by Site ID (zero-padded, e.g. "01").</p>

        <hr className="border-[#808080] my-4" />

        <p className="font-bold mb-2">RESPONSE FORMAT</p>
        <p className="mb-1">All responses return JSON. HTTP 200 on success.</p>
        <p className="mb-1">List responses include: total, limit, offset, records[].</p>
        <p className="mb-1">Each record includes: site_id, plaza_name, location, survey_date,</p>
        <p className="mb-1">demolition_horizon, status, classification, environmental_metrics,</p>
        <p className="mb-1">field_notes, permit_reference, coordinates.</p>

        <hr className="border-[#808080] my-4" />

        <p className="font-bold mb-2">ERROR CODES</p>
        <p className="mb-1">401 — Missing or invalid API key</p>
        <p className="mb-1">429 — Daily rate limit exceeded (100 req/day)</p>
        <p className="mb-1">404 — Record not found</p>
        <p className="mb-1">500 — Internal server error</p>

        <hr className="border-[#808080] my-4" />

        <p className="font-bold mb-2">NOTES</p>
        <p className="mb-1">Data reflects Miami-Dade County permit records and is updated daily.</p>
        <p className="mb-1">AI-generated field assessments are documentary in nature and do not</p>
        <p className="mb-1">constitute official municipal records.</p>
        <p className="mb-1">All data is read-only. No write access is available via this API.</p>
      </div>
    </div>
  );
}
