import { useState } from "react";
import { useGetSurveys } from "@workspace/api-client-react";
import type { GetSurveysHorizon, GetSurveysSortDir } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";

const STATUS_COLORS = {
  "IMMINENT": "#cc0000",
  "NEAR-TERM": "#cc6600",
  "PROJECTED": "#ccaa00",
  "EXPIRED": "#666666"
} as const;

export default function ListView() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [horizon, setHorizon] = useState<GetSurveysHorizon | "">("");
  const [sortBy, setSortBy] = useState<string>("id");
  const [sortDir, setSortDir] = useState<GetSurveysSortDir>("asc");

  const { data: surveys = [], isLoading } = useGetSurveys({
    search: search || undefined,
    horizon: horizon ? (horizon as GetSurveysHorizon) : undefined,
    sortBy,
    sortDir
  });

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

  return (
    <div className="win98-window p-4 h-full flex flex-col">
      <div className="flex gap-6 mb-4 items-end bg-[#d4d0c8] p-3 border-2 border-[#808080] border-t-[#fff] border-l-[#fff]">
        <div>
          <label className="block text-xs font-bold mb-1">SEARCH RECORDS:</label>
          <input 
            type="text" 
            className="win98-window-inset px-2 py-1 text-sm w-64 border-2 border-[#808080] border-t-[#000] border-l-[#000]"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Enter search term..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">HORIZON FILTER:</label>
          <select 
            className="win98-window-inset px-2 py-1 text-sm border-2 border-[#808080] border-t-[#000] border-l-[#000]"
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
      </div>

      <div className="flex-1 overflow-auto win98-window-inset bg-white p-1">
        <div className="border-2 border-[#808080] border-t-[#000] border-l-[#000] h-full overflow-auto">
          {isLoading ? (
            <div className="p-4 text-sm font-bold">LOADING RECORDS...</div>
          ) : (
            <table className="win98-table">
              <thead>
                <tr>
                  <th className="cursor-pointer hover:bg-[#0000AA]" onClick={() => handleSort("siteId")}>SITE ID<SortIcon field="siteId" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA]" onClick={() => handleSort("plazaName")}>PLAZA NAME<SortIcon field="plazaName" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA]" onClick={() => handleSort("location")}>LOCATION<SortIcon field="location" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA]" onClick={() => handleSort("surveyDate")}>SURVEY DATE<SortIcon field="surveyDate" /></th>
                  <th className="cursor-pointer hover:bg-[#0000AA]" onClick={() => handleSort("demolitionHorizon")}>HORIZON<SortIcon field="demolitionHorizon" /></th>
                  <th>CLASSIFICATION</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey, index) => (
                  <tr 
                    key={survey.id} 
                    className="cursor-pointer hover:bg-[#0000EE] hover:text-white group"
                    onClick={() => setLocation(`/report/${survey.id}`)}
                  >
                    <td className="group-hover:text-white text-[#0000EE] underline">{String(index + 1).padStart(2, '0')}</td>
                    <td>{survey.plazaName}</td>
                    <td>{survey.location}</td>
                    <td>{survey.surveyDate}</td>
                    <td>{survey.demolitionHorizon}</td>
                    <td>{survey.plazaType}</td>
                    <td className="text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span 
                          className="w-2 h-2 inline-block border border-black flex-shrink-0"
                          style={{ backgroundColor: STATUS_COLORS[survey.demolitionHorizon as keyof typeof STATUS_COLORS] || '#000' }}
                        ></span>
                        {survey.status}
                      </span>
                    </td>
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
