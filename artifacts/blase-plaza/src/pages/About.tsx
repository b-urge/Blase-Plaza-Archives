export default function About() {
  return (
    <div className="win98-window p-8 h-full max-w-3xl text-[13px] leading-relaxed">
      <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">
        ABOUT BLASÉ PLAZA ARCHIVES
      </h2>

      <p className="mb-4">
        <strong>ESTABLISHED:</strong> 2026
        <br />
        <strong>JURISDICTION:</strong> Broward County
      </p>

      <hr className="my-6 border-black" />

      <h3 className="font-bold mb-2 text-base">MISSION STATEMENT</h3>
      <p className="mb-4">
        The Blasé Plaza Archive is a database of strip malls and commercial
        plazas that are slated for demolition, redevelopment, or have otherwise
        closed down.
      </p>

      <p className="mb-4">
        As the county grows and zoning changes, these properties are
        disappearing faster than they're being documented. They represent a
        distinct era of commercial development — and a practical record of how
        neighborhoods have changed — but most are torn down without any
        systematic record being kept.
      </p>

      <p className="mb-4">
        This archive focuses on the period just before demolition or renovation,
        when a site shows the most information: which units are vacant, how
        signage and infrastructure have degraded, how many tenants have turned
        over. For sites being renovated rather than demolished, the archive
        tracks how physical changes correlate with shifts in population, income,
        and the types of businesses moving in — distinguishing between what's
        being updated and what's being replaced entirely.
      </p>

      <p className="mb-6">
        Each entry includes architectural details, construction date, current
        occupancy, and ambient sound recordings. Everything is publicly
        accessible through an interactive dashboard and updated as conditions
        change.
      </p>

      <h3 className="font-bold mb-2 text-base">DATA COLLECTION METHODOLOGY</h3>
      <p className="mb-4">
        Field agents visit sites before demolition or renovation to record
        specific conditions: parking lot deterioration, shade coverage
        (artificial and natural), how much original signage is still up, and the
        general state of the building.
      </p>
      <p className="mb-4">
        For sites marked for renovation, census tract data is collected
        alongside the physical notes and updated regularly. This includes
        changes in local population, median household income, and what types of
        businesses are moving in or out. Tracking both together makes it
        possible to compare how a building's transformation maps onto changes in
        the surrounding neighborhood over time.
      </p>
      <p className="mb-6">
        Every record is dated and tagged with a site status at time of entry:
        Demolition Pending, Renovation Pending, Declining, or Post-Intervention.
        Records are never deleted — once a site is demolished or renovated, it
        stays in the archive. A site that no longer exists is still a data
        point.
      </p>

      <hr className="my-6 border-black" />

      <div className="text-center text-xs text-gray-700 font-bold">
        <p>SYSTEM ADMIN: K.BURGE</p>
      </div>
    </div>
  );
}
