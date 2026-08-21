import { useState, type FormEvent } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ApiAccess() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const apiBase = `${origin}${BASE}/api/v1/`;

  const [submitting, setSubmitting] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const resp = await fetch(`${BASE}/api/keys/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          intendedUse: String(form.get("intended_use") ?? ""),
        }),
      });
      const data = (await resp.json()) as { key?: string; message?: string };
      if (!resp.ok || !data.key) {
        setError(data.message ?? "Your request could not be processed.");
        return;
      }
      setIssuedKey(data.key);
    } catch {
      setError("Your request could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
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
        <p className="font-bold text-sm mb-4 uppercase tracking-wide">
          BLASÉ PLAZA ARCHIVES — DATA ACCESS API
        </p>

        <p className="text-sm mb-3">
          This API provides programmatic read-only access to the Blasé Plaza
          Archives survey database. All records reflect permit data sourced from
          Broward County open data systems and field assessments based on
          documentary evidence available at time of survey.
        </p>
        <p className="text-sm mb-3">
          Access is free and keys are issued immediately — no approval queue.
        </p>

        <div className="text-sm p-3 border-2 border-[#808080] bg-[#f0ede8] mb-3">
          <p className="font-bold mb-1">NOTICE — HOBBY PROJECT</p>
          <p className="mb-1">
            This is an independent personal project, not affiliated with any
            municipal authority. The archive is under continuous revision.
          </p>
          <p>
            Records, classifications, and site identifiers change without
            versioning or deprecation notice. Do not build production
            dependencies on this API.
          </p>
        </div>

        <div
          className="text-sm p-3 border border-[#808080] bg-[#f0ede8] mb-3 overflow-x-auto"
          style={{ fontFamily: "Courier New, monospace" }}
        >
          <p className="mb-1">Base URL: {apiBase}</p>
          <p className="mb-1">
            Authentication: Include your key in the request header:
          </p>
          <p className="mb-1 pl-4">X-BPA-API-Key: YOUR-KEY-HERE</p>
          <p className="mb-1">Rate limit: 100 requests per day per key.</p>
        </div>

        <p className="text-sm">
          Data is updated daily. Records reflect permit status as of the most
          recent sync.
        </p>
      </div>

      <hr className="border-black mb-6" />

      {/* Section 2 — Request Key Form */}
      <div className="mb-6">
        <p className="font-bold text-sm mb-4 uppercase tracking-wide">
          REQUEST AN API KEY — ISSUED INSTANTLY
        </p>

        {issuedKey ? (
          <div
            className="p-4 border-2 border-black text-sm leading-relaxed"
            style={{ background: "#f5f0e8" }}
          >
            <p className="font-bold mb-3">KEY ISSUED</p>
            <p className="mb-3">
              Your API key is below. Copy it now — it is shown once and is not
              recoverable from this page.
            </p>
            <p
              className="mb-3 p-2 border border-[#808080] bg-white break-all select-all"
              style={{ fontFamily: "Courier New, monospace" }}
            >
              {issuedKey}
            </p>
            <p>
              Send it with every request as the header{" "}
              <span style={{ fontFamily: "Courier New, monospace" }}>
                X-BPA-API-Key
              </span>
              . Rate limit: 100 requests per day.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 max-w-lg"
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">YOUR NAME:</label>
              <input
                type="text"
                name="name"
                required
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm"
                style={{ borderStyle: "inset" }}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">
                EMAIL ADDRESS:
              </label>
              <input
                type="email"
                name="email"
                required
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm"
                style={{ borderStyle: "inset" }}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">
                INTENDED USE:
              </label>
              <textarea
                name="intended_use"
                required
                rows={4}
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm resize-none"
                style={{ borderStyle: "inset" }}
                disabled={submitting}
              />
            </div>

            {error !== null && (
              <div
                className="p-4 border-2 border-black text-sm leading-relaxed"
                style={{ background: "#f5f0e8" }}
              >
                <p className="font-bold mb-3">SUBMISSION ERROR</p>
                <p>
                  {error} If the problem persists, contact the archive
                  administrator at k@burge.world
                </p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: "#d4d0c8",
                  border: "2px outset #ffffff",
                  fontFamily: "Verdana, Arial, sans-serif",
                  cursor: submitting ? "default" : "pointer",
                  fontSize: "13px",
                  padding: "4px 12px",
                }}
              >
                {submitting ? "[ ISSUING... ]" : "[ REQUEST KEY ]"}
              </button>
            </div>
          </form>
        )}
      </div>

      <hr className="border-black mb-6" />

      {/* Section 3 — Documentation */}
      <div className="text-sm leading-relaxed">
        <p className="font-bold mb-3 uppercase tracking-wide">
          API DOCUMENTATION
        </p>

        <p className="font-bold mb-2">ENDPOINTS</p>
        <p className="mb-1" style={{ fontFamily: "Courier New, monospace" }}>
          GET /api/v1/plazas
        </p>
        <p className="mb-1 pl-4">
          Returns all plaza records. Optional query parameters:
        </p>
        <p
          className="mb-1 pl-8"
          style={{ fontFamily: "Courier New, monospace" }}
        >
          ?horizon=IMMINENT|NEAR-TERM|PROJECTED|EXPIRED
        </p>
        <p
          className="mb-1 pl-8"
          style={{ fontFamily: "Courier New, monospace" }}
        >
          ?classification=[plaza type]
        </p>
        <p
          className="mb-1 pl-8"
          style={{ fontFamily: "Courier New, monospace" }}
        >
          ?limit=[integer, max 100]
        </p>
        <p
          className="mb-1 pl-8"
          style={{ fontFamily: "Courier New, monospace" }}
        >
          ?offset=[integer, for pagination]
        </p>

        <p
          className="mt-3 mb-1"
          style={{ fontFamily: "Courier New, monospace" }}
        >
          GET /api/v1/plazas/:site_id
        </p>
        <p className="mb-1 pl-4">
          Returns a single plaza record by Site ID (zero-padded, e.g. "01").
        </p>

        <hr className="border-[#808080] my-4" />

        <p className="font-bold mb-2">RESPONSE FORMAT</p>
        <p className="mb-1">All responses return JSON. HTTP 200 on success.</p>
        <p className="mb-1">
          List responses include: total, limit, offset, records[].
        </p>
        <p className="mb-1">
          Each record includes:{" "}
          <span style={{ fontFamily: "Courier New, monospace" }}>site_id</span>,
          plaza_name, location, survey_date, demolition_horizon, status,
          classification, environmental_metrics, field_notes,{" "}
          <span style={{ fontFamily: "Courier New, monospace" }}>
            permit_reference
          </span>
          ,{" "}
          <span style={{ fontFamily: "Courier New, monospace" }}>
            coordinates
          </span>
          .
        </p>

        <hr className="border-[#808080] my-4" />

        <p className="font-bold mb-2">ERROR CODES</p>
        <p className="mb-1">401 — Missing or invalid API key</p>
        <p className="mb-1">429 — Daily rate limit exceeded (100 req/day)</p>
        <p className="mb-1">404 — Record not found</p>
        <p className="mb-1">500 — Internal server error</p>

        <hr className="border-[#808080] my-4" />

        <p className="font-bold mb-2">NOTES</p>
        <p className="mb-1">
          Data reflects Broward County permit records and is updated daily.
        </p>
        <p className="mb-1">
          Coverage is currently limited to the City of Fort Lauderdale.
        </p>
        <p className="mb-1">
          Survey reports are generated by a language model from public permit
          and parcel records. Environmental metrics are inferred, not
          field-measured.
        </p>
        <p className="mb-1">
          Field assessments are documentary in nature and do not constitute
          official municipal records.
        </p>
        <p className="mb-1">
          All data is read-only. No write access is available via this API.
        </p>
      </div>
    </div>
  );
}
