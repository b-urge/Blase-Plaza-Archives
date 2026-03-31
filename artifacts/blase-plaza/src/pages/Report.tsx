import { useGetSurveyById } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";

export default function Report() {
  const [, params] = useRoute("/report/:id");
  const id = parseInt(params?.id || "0");
  
  const { data: survey, isLoading } = useGetSurveyById(id, {
    query: { enabled: !!id }
  });

  if (isLoading) {
    return <div className="p-4 font-bold">LOADING FILE...</div>;
  }

  if (!survey) {
    return <div className="p-4 font-bold text-[#cc0000]">ERROR: FILE NOT FOUND</div>;
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between gap-2 mb-4">
        <Link href="/list">
          <span className="win98-button">[ ← BACK TO LIST ]</span>
        </Link>
        <button 
          className="win98-button"
          onClick={() => window.print()}
        >
          [ PRINT / EXPORT PDF ]
        </button>
      </div>

      <div className="bg-[#f5f0e8] border-2 border-[#333] p-4 md:p-8 text-[13px] text-black shadow-none flex-1 overflow-auto">
        <div className="border-b-2 border-[#333] pb-4 mb-6 text-center">
          <h1 className="text-xl font-bold tracking-wider">BLASÉ PLAZA ARCHIVES</h1>
          <p className="mt-1 font-bold">OFFICIAL FIELD REPORT</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 border-b-2 border-[#333] pb-6">
          <div className="space-y-1">
            <p><strong>SITE ID:</strong> {survey.siteId}</p>
            <p><strong>NAME:</strong> {survey.plazaName}</p>
            <p><strong>LOCATION:</strong> {survey.location}</p>
            <p><strong>SURVEY DATE:</strong> {survey.surveyDate}</p>
          </div>
          <div className="space-y-1">
            <p><strong>STATUS:</strong> {survey.status}</p>
            <p><strong>HORIZON:</strong> {survey.demolitionHorizon}</p>
            <p><strong>PLAZA TYPE:</strong> {survey.plazaType}</p>
            <p><strong>ARCH. STYLE:</strong> {survey.architecturalStyle}</p>
            <p><strong>PERMIT NO:</strong> {survey.permitNo || 'N/A'}</p>
          </div>
        </div>

        <div className="mb-6 border-b-2 border-[#333] pb-6">
          <h3 className="font-bold mb-3 uppercase tracking-wider">Metrical Assessment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#e8e0d5] p-4 border border-[#999]">
            <p><strong>PARKING ENTROPY:</strong> {survey.parkingEntropy}</p>
            <p><strong>SHADE COVERAGE:</strong> {survey.shadeCoverage}</p>
            <p><strong>SIGNAGE DENSITY:</strong> {survey.signageDensity}</p>
            <p><strong>VACANCY RATIO:</strong> {survey.vacancyRatio}</p>
            <p><strong>PEDESTRIAN ACTIVITY:</strong> {survey.pedestrianActivity}</p>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="font-bold mb-3 uppercase tracking-wider">Field Agent Notes</h3>
          <div className="bg-[#ffffff] border border-[#999] p-4">
            <p className="font-bold mb-3 border-b border-[#ccc] pb-2">
              SITE STATUS: {survey.status}
            </p>
            <pre className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed" style={{ fontFamily: "inherit" }}>
              {survey.reportText}
            </pre>
          </div>
        </div>

        <div className="border-t-2 border-[#333] pt-4 text-xs text-center text-gray-600 font-bold tracking-widest">
          REF: {survey.documentRef} // SITE: {survey.siteId} // MIAMI-DADE COUNTY
        </div>
      </div>
    </div>
  );
}
