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
        The Blasé Plaza Archive serves as the official operational repository for documenting commercial retail structures, colloquially known as "strip malls" or "plazas," scheduled for demolition, major redevelopment, or that have otherwise reached the end of their viable economic lifespan.
      </p>

      <p className="mb-4">
        As the county expands and density requirements shift, these transitional spaces provide crucial data points regarding mid-to-late 20th century commercial planning, asphalt decay rates, and localized economic micro-climates. They are also something harder to quantify: liminal infrastructure. Neither destination nor non-place, the strip plaza exists at the edge of civic attention, functional, unremarkable, and largely undocumented until the moment it is gone.
      </p>

      <p className="mb-4">
        This archive operates on the premise that the period immediately preceding demolition or renovation is the most data-rich moment in a structure's lifespan. It is when vacancy patterns, signage degradation, tenant turnover, and surrounding demographic shift are most legible and most at risk of being lost. For sites undergoing renovation, the archive maintains longitudinal records tracking how physical transformation correlates with changes in population density, household income, and commercial composition over time, distinguishing between what is being updated and what is being replaced.
      </p>

      <p className="mb-4">
        Each catalogued structure is assigned a profile encompassing architectural characteristics, construction era, current occupancy status, and ambient acoustic data. This information is made publicly accessible through the Archive's interactive dashboard and updated continuously as site conditions evolve.
      </p>

      <p className="mb-6">
        The Blasé Plaza Archive does not argue for preservation. It argues for the record.
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
