import { useGetSurveyStats, useSeedSampleData, useSyncPermits, getGetSurveyStatsQueryKey, getGetSurveysQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function Home() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading } = useGetSurveyStats();
  
  const seedMutation = useSeedSampleData({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSurveyStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSurveysQueryKey() });
      }
    }
  });

  const syncMutation = useSyncPermits({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSurveyStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSurveysQueryKey() });
      }
    }
  });

  return (
    <div className="win98-window p-6 h-full">
      <h2 className="text-xl font-bold mb-2">WELCOME TO THE BLASÉ PLAZA ARCHIVES</h2>
      <hr />
      
      <p className="mb-6 leading-relaxed">
        This database serves as the central repository for field surveys of commercial plazas in Miami-Dade County slated for demolition or significant redevelopment.
      </p>

      <div className="win98-window-inset p-4 mb-6">
        <h3 className="font-bold mb-3 uppercase border-b-2 border-[#c0c0c0] pb-1">Database Statistics</h3>
        {isLoading ? (
          <p className="font-mono text-sm">Loading statistics...</p>
        ) : stats ? (
          <ul className="space-y-2 font-mono text-sm">
            <li><strong>TOTAL RECORDS:</strong> {stats.total}</li>
            <li className="mt-3 pt-3 border-t border-[#c0c0c0]"><strong>BY STATUS:</strong></li>
            <li className="pl-2">Demolition Pending: {(stats as any).byStatus?.["Demolition Pending"] ?? 0}</li>
            <li className="pl-2">Renovation Pending: {(stats as any).byStatus?.["Renovation Pending"] ?? 0}</li>
            <li className="pl-2">Declining: {(stats as any).byStatus?.["Declining"] ?? 0}</li>
            <li className="pl-2">Active: {(stats as any).byStatus?.["Active"] ?? 0}</li>
            <li className="pl-2">Post-Intervention: {(stats as any).byStatus?.["Post-Intervention"] ?? 0}</li>
            <li className="mt-4 pt-4 border-t-2 border-[#c0c0c0] text-[#666]">
              Last Updated: {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'N/A'}
            </li>
          </ul>
        ) : (
          <p className="font-mono text-sm text-[#cc0000]">SYSTEM ERROR: Unable to load statistics.</p>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <Link href="/map">
          <span className="win98-button">[ VIEW MAP ]</span>
        </Link>
        <Link href="/list">
          <span className="win98-button">[ VIEW RECORDS ]</span>
        </Link>
      </div>

      <hr />

      <div className="mt-8 p-4 bg-[#d4d0c8] border-2 border-[#808080]">
        <p className="text-sm mb-1 font-bold">SYSTEM MAINTENANCE</p>
        <p className="text-xs mb-3">Only use these functions for manual data synchronization and initialization.</p>
        
        <div className="flex gap-4">
          <button 
            className="win98-button text-xs" 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? "[ SYNCING... ]" : "[ SYNC PERMITS ]"}
          </button>
          
          <button 
            className="win98-button text-xs" 
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? "[ LOADING... ]" : "[ INITIALIZE DATABASE RECORDS ]"}
          </button>
        </div>

        {(seedMutation.isSuccess || syncMutation.isSuccess) && (
          <p className="text-[#008000] text-xs mt-2 font-bold">Operation completed successfully.</p>
        )}
        {(seedMutation.isError || syncMutation.isError) && (
          <p className="text-[#cc0000] text-xs mt-2 font-bold">Error during operation.</p>
        )}
      </div>
    </div>
  );
}
