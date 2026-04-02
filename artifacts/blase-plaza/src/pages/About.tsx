export default function About() {
  return (
    <div className="win98-window p-8 h-full max-w-3xl text-[13px] leading-relaxed">
      <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">ABOUT BLASÉ PLAZA ARCHIVES</h2>
      
      <p className="mb-4">
        <strong>ESTABLISHED:</strong> 2026<br />
        <strong>JURISDICTION:</strong> Miami-Dade County
      </p>

      <hr className="my-6 border-black" />

      <h3 className="font-bold mb-2 text-base">MISSION STATEMENT</h3>
      <p className="mb-4">
        The Blasé Plaza Archive is a database of strip malls and commercial plazas that are slated for demolition, redevelopment, or have otherwise closed down.
      </p>

      <p className="mb-4">
        As the county grows and zoning changes, these properties are disappearing faster than they're being documented. They represent a distinct era of commercial development — and a practical record of how neighborhoods have changed — but most are torn down without any systematic record being kept.
      </p>

      <p className="mb-4">
        This archive focuses on the period just before demolition or renovation, when a site shows the most information: which units are vacant, how signage and infrastructure have degraded, how many tenants have turned over. For sites being renovated rather than demolished, the archive tracks how physical changes correlate with shifts in population, income, and the types of businesses moving in — distinguishing between what's being updated and what's being replaced entirely.
      </p>

      <p className="mb-6">
        Each entry includes architectural details, construction date, current occupancy, and ambient sound recordings. Everything is publicly accessible through an interactive dashboard and updated as conditions change.
      </p>

      <h3 className="font-bold mb-2 text-base">DATA COLLECTION METHODOLOGY</h3>
      <p className="mb-4">
        Field agents dispatch to slated sites to record vital metrics including parking entropy, shade coverage (artificial and natural), remaining signage density, and overall structural malaise. Photographic evidence is currently maintained in physical filing cabinets off-site; this digital terminal only reflects quantitative metrics and qualitative field notes.
      </p>
      <p className="mb-4">
        Ambient acoustic surveys are conducted independently of visual field documentation. Each site receives a dedicated sound profile capturing baseline audio conditions including mechanical hum, traffic proximity, HVAC output, and occupant-generated noise. These recordings are logged as a separate data category and treated as a measurable characteristic of the site's operational state at time of survey.
      </p>
      <p className="mb-4">
        For sites designated as renovation candidates, supplementary demographic data is collected at the census tract level and updated on a rolling basis. Tracked indicators include residential population change, median household income shift, and commercial tenant classification over time. This data is maintained in parallel with structural field notes to allow for longitudinal comparison between physical site transformation and surrounding population change.
      </p>
      <p className="mb-6">
        All field data is assigned a collection date and site status at time of entry: Active, Declining, Renovation Pending, Demolition Pending, or Post-Intervention. Records for Post-Intervention sites remain in the Archive indefinitely and are not removed upon completion of demolition or renovation. The Archive considers a closed site an active data point.
      </p>

      <hr className="my-6 border-black" />
      
      <div className="text-center text-xs text-gray-700 font-bold">
        <p>SYSTEM ADMIN: K.BURGE</p>
      </div>
    </div>
  );
}
