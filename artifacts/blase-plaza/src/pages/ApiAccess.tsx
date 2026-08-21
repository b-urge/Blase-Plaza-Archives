const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ApiAccess() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const apiBase = `${origin}${BASE}/api/v1/`;

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
          Access is open. No key, registration, or authentication is required.
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
          <p className="mb-1">Authentication: none required.</p>
          <p className="mb-1">Format: JSON.</p>
        </div>

        <p className="text-sm">
          Data is updated daily. Records reflect permit status as of the most
          recent sync.
        </p>
      </div>

      <hr className="border-black mb-6" />

      <div className="mb-6 text-sm leading-relaxed">
        <p className="font-bold mb-3 uppercase tracking-wide">USING THE DATA</p>
        <p className="mb-3">
          The archive is a personal project and the API is provided as-is.
          Please be considerate with request volume — there is no rate limit,
          only the assumption that you will not need one.
        </p>
        <p>
          If you build something with this data, or you need it in a shape the
          API does not provide, get in touch: k@burge.world
        </p>
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
