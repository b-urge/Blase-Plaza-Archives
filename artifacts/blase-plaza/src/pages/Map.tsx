import { useGetSurveys } from "@workspace/api-client-react";
import { Link } from "wouter";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

const HORIZON_COLORS = {
  "IMMINENT": "#cc0000",
  "NEAR-TERM": "#cc6600",
  "PROJECTED": "#ccaa00",
  "EXPIRED": "#666666"
} as const;

export default function MapView() {
  const { data: surveys = [] } = useGetSurveys();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-2 font-bold">[ INTERACTIVE SITE MAP — MIAMI-DADE COUNTY ]</div>
      <div className="flex-1 flex gap-4 min-h-[400px] md:min-h-[600px]">
        <div className="flex-1 win98-window-inset border-2 border-[#808080] relative z-0 p-1 bg-white">
          <div className="w-full h-full border-2 border-[#808080] border-t-[#000] border-l-[#000] overflow-hidden">
            <MapContainer 
              center={[25.7617, -80.1918]} 
              zoom={10} 
              style={{ height: "100%", width: "100%", zIndex: 1 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {surveys.filter(s => s.latitude && s.longitude).map(survey => (
                <CircleMarker
                  key={survey.id}
                  center={[survey.latitude!, survey.longitude!]}
                  pathOptions={{ 
                    fillColor: HORIZON_COLORS[survey.demolitionHorizon as keyof typeof HORIZON_COLORS] || '#000', 
                    color: '#000', 
                    weight: 1, 
                    fillOpacity: 0.9 
                  }}
                  radius={8}
                >
                  <Popup>
                    <div className="font-sans text-sm pb-1">
                      <strong className="block border-b border-[#c0c0c0] mb-1 pb-1">{survey.plazaName}</strong>
                      <div className="text-xs mb-1">LOC: {survey.location}</div>
                      <div className="text-xs mb-1">HORIZON: {survey.demolitionHorizon}</div>
                      <div className="text-xs mb-2">STATUS: {survey.status}</div>
                      <Link href={`/report/${survey.id}`}>
                        <span className="text-[#0000EE] underline cursor-pointer inline-block text-xs font-bold">
                          [ VIEW FULL REPORT ]
                        </span>
                      </Link>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          
          <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-[400] win98-window p-1 md:p-2 text-xs">
            <div className="font-bold mb-2 border-b-2 border-[#808080] pb-1">MAP LEGEND</div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#cc0000] border border-black"></div> IMMINENT</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#cc6600] border border-black"></div> NEAR-TERM</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ccaa00] border border-black"></div> PROJECTED</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#666666] border border-black"></div> EXPIRED</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
