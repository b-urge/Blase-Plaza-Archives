import { useState } from "react";
import { useGetSurveys } from "@workspace/api-client-react";
import type { GetSurveysHorizon, GetSurveysSortDir } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";

const MODAL_TEXT = `Each catalogued structure is assigned a demolition horizon based on the status of active permits, confirmed redevelopment agreements, and field-assessed site conditions at the time of survey. Horizon classifications are not predictive in the strict sense — they reflect the documentary record as it exists, not projections of future municipal action.

IMMINENT — A demolition permit has been filed and approved, or demolition activity has been confirmed as actively underway at the time of the survey. These sites are in the final phase of their operational lifespan. Documentation priority is highest.

NEAR-TERM — Active building or redevelopment permits indicate that significant structural intervention is planned within the foreseeable future. The site may still be partially occupied or operational. Field surveys at this stage capture the transition period between function and replacement.

PROJECTED — The site shows material indicators of decline — elevated vacancy, deferred maintenance, reduced signage density — consistent with properties under development pressure, but no permit activity has been confirmed. Classification reflects observed conditions, not scheduled action.

EXPIRED — Demolition or transformation is complete. The archive retains the pre-intervention record for longitudinal reference.

Horizon classifications are subject to revision as permit status changes. Sites may move between categories across survey cycles.`;

export default function ListView() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [horizon, setHorizon] = useState<GetSurveysHorizon | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>("id");
  const [sortDir, setSortDir] = useState<GetSurveysSortDir>("asc");
  const [showModal, setShowModal] = useState(false);

  const { data: rawSurveys = [], isLoading } = useGetSurveys({
    search: search || undefined,
    horizon: horizon ? (horizon as GetSurveysHorizon) : undefined,
    sortBy,
    sortDir
  });

  const surveys = statusFilter
    ? rawSurveys.filter(s => s.status === statusFilter)
    : rawSurveys;

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortDir === "asc" ? <span> ▲</span> : <span> ▼</span>;
  };

  const formatModalText = (text: string) => {
    const horizons = ["IMMINENT", "NEAR-TERM", "PROJECTED", "EXPIRED"];
    return text.split("\n").map((line, i) => {
      const matchedHorizon = horizons.find(h => line.startsWith(h + " —"));
      if (matchedHorizon) {
        const rest = line.slice(matchedHorizon.length);
        return <p key={i} className="mb-3"><strong>{matchedHorizon}</strong>{rest}</p>;
      }
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="mb-3">{line}</p>;
    });
  };

  return (
    <div className="win98-window p-4 h-full flex flex-col">

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto"
            style={{
              background: "#f5f0e8",
              border: "2px solid #333",
              padding: "28px 32px",
              fontSize: "13px",
              lineHeight: "1.7",
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: "absolute",
                top: "10px",
                right: "12px",
                background: "#d4d0c8",
                border: "2px outset #ffffff",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: "bold",
                padding: "1px 7px",
                fontFamily: "inherit",
              }}
            >X</button>

            <h2 style={{ fontFamily: "Verdana, Arial, sans-serif", fontWeight: "bold", fontSize: "13px", letterSpacing: "0.05em", marginBottom: "10px" }}>
              DEMOLITION HORIZON CLASSIFICATIONS
            </h2>
            <hr style={{ borderColor: "#333", marginBottom: "16px" }} />
            <div>{formatModalText(MODAL_TEXT)}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:gap-6 md:items-end gap-3 mb-4 bg-[#d4d0c8] p-3 border-2 border-[#808080] border-t-[#fff] border-l-[#fff]">
        <div>
          <label className="block text-xs font-bold mb-1">SEARCH RECORDS:</label>
          <input
            type="text"
            className="win98-window-inset px-2 py-1 text-sm w-full md:w-64 border-2 border-[#808080] border-t-[#000] border-l-[#000]"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Enter search term..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">HORIZON FILTER:</label>
          <select
            className="win98-window-inset px-2 py-1 text-sm w-full md:w-auto border-2 border-[#808080] border-t-[#000] border-l-[#000]"
            value={horizon}
            onChange={e => setHorizon(e.target.value as GetSurveysHorizon | "")}
          >
            <option value="">-- ALL HORIZONS --</option>
            <option value="IMMINENT">IMMINENT</option>
            <option value="NEAR-TERM">NEAR-TERM</option>
            <option value="PROJECTED">PROJECTED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">STATUS FILTER:</label>
          <select
            className="win98-window-inset px-2 py-1 text-sm w-full md:w-auto border-2 border-[#808080] border-t-[#000] border-l-[#000]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">-- ALL STATUSES --</option>
            <option value="Active">Active</option>
            <option value="Declining">Declining</option>
            <option value="Renovation Pending">Renovation Pending</option>
            <option value="Demolition Pending">Demolition Pending</option>
            <option value="Post-Intervention">Post-Intervention</option>
          </select>
        </div>
      </div>

      <div className="mb-2 text-xs">
        <button
          onClick={() => setShowModal(true)}
          className="text-[#0000EE] underline cursor-pointer bg-transparent border-none p-0 text-xs"
          style={{ fontFamily: "inherit" }}
        >
          DEMOLITION HORIZON CLASSIFICATIONS
        </button>
      </div>

      <div className="flex-1 overflow-auto win98-window-inset bg-white p-1">
        <div className="border-2 border-[#808080] border-t-[#000] border-l-[#000] h-full overflow-x-auto">
          {isLoading ? (
            <div className="p-4 text-sm font-bold">LOADING RECORDS...</div>
          ) : (
            <table className="win98-table">
              <thead>
                <tr>
                  <th className="cursor-pointer hover:bg-[#0000AA] whitespace-nowrap" onClick={() => handleSort("siteId")}>SITE ID<SortIcon field="siteId" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA] whitespace-nowrap" onClick={() => handleSort("plazaName")}>PLAZA NAME<SortIcon field="plazaName" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA] whitespace-nowrap" onClick={() => handleSort("location")}>LOCATION<SortIcon field="location" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA] whitespace-nowrap" onClick={() => handleSort("surveyDate")}>SURVEY DATE<SortIcon field="surveyDate" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA] whitespace-nowrap" onClick={() => handleSort("demolitionHorizon")}>HORIZON<SortIcon field="demolitionHorizon" /></th>
                  <th className="whitespace-nowrap">CLASSIFICATION</th>
                  <th className="whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey, index) => (
                  <tr
                    key={survey.id}
                    className="cursor-pointer hover:bg-[#0000EE] hover:text-white group"
                    onClick={() => setLocation(`/report/${survey.id}`)}
                  >
                    <td className="group-hover:text-white text-[#0000EE] underline whitespace-nowrap" style={{ fontFamily: "Courier New, monospace" }}>{String(index + 1).padStart(2, '0')}</td>
                    <td>{survey.plazaName}</td>
                    <td>{survey.location}</td>
                    <td className="whitespace-nowrap">{survey.surveyDate}</td>
                    <td className="whitespace-nowrap">{survey.demolitionHorizon}</td>
                    <td>{survey.plazaType}</td>
                    <td>{survey.status}</td>
                  </tr>
                ))}
                {surveys.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-4">NO RECORDS FOUND</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
