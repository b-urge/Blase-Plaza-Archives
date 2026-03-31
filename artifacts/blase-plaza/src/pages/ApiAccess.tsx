import { useForm } from "@formspree/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ApiAccess() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const apiBase = `${origin}${BASE}/api/v1/`;

  const [state, handleSubmit] = useForm("mqegbakq");

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
          This API provides programmatic read-only access to the Blasé Plaza Archives survey
          database. All records reflect permit data sourced from Miami-Dade County open data systems
          and field assessments based on documentary evidence available at time of survey.
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

        {state.succeeded ? (
          <div
            className="p-4 border-2 border-black text-sm leading-relaxed"
            style={{ background: "#f5f0e8", fontFamily: "Courier New, monospace" }}
          >
            <p className="font-bold mb-3">REQUEST RECEIVED</p>
            <p className="mb-1">
              Your access request has been submitted. The archive administrator
            </p>
            <p className="mb-1">
              will review your request and respond to the email address provided.
            </p>
            <p className="mt-3">Allow 1-3 business days for a response.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">YOUR NAME:</label>
              <input
                type="text"
                name="name"
                required
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm"
                style={{ borderStyle: "inset" }}
                disabled={state.submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">EMAIL ADDRESS:</label>
              <input
                type="email"
                name="email"
                required
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm"
                style={{ borderStyle: "inset" }}
                disabled={state.submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold uppercase">INTENDED USE:</label>
              <textarea
                name="intended_use"
                required
                rows={4}
                className="border-2 border-[#808080] bg-white px-2 py-1 text-sm resize-none"
                style={{ borderStyle: "inset" }}
                disabled={state.submitting}
              />
            </div>

            {state.errors !== null && (
              <div
                className="p-4 border-2 border-black text-sm leading-relaxed"
                style={{ background: "#f5f0e8", fontFamily: "Courier New, monospace" }}
              >
                <p className="font-bold mb-3">SUBMISSION ERROR</p>
                <p className="mb-1">Your request could not be sent. Please try again or contact the</p>
                <p>archive administrator directly at k@burge.world</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={state.submitting}
                style={{
                  background: "#d4d0c8",
                  border: "2px outset #ffffff",
                  fontFamily: "Verdana, Arial, sans-serif",
                  cursor: state.submitting ? "default" : "pointer",
                  fontSize: "13px",
                  padding: "4px 12px",
                }}
              >
                {state.submitting ? "[ SENDING... ]" : "[ SUBMIT REQUEST ]"}
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
        <p className="mb-1">Field assessments are documentary in nature and do not constitute official municipal records.</p>
        <p className="mb-1">All data is read-only. No write access is available via this API.</p>
      </div>
    </div>
  );
}
