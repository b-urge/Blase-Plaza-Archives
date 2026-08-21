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

      <div className="win98-window-inset p-4 mb-6 text-[12px]">
        <p className="font-bold mb-2">NOTICE</p>
        <p className="mb-2">
          This archive is an independent hobby project maintained by one person.
          It is not affiliated with Broward County, the City of Fort Lauderdale,
          or any municipal authority.
        </p>
        <p className="mb-2">
          Records are added, reclassified, and corrected continuously.
          Classifications, methodology, and site identifiers are still settling
          and may change without notice.
        </p>
        <p>
          Survey reports are generated from public permit and parcel records and
          are documentary in nature. For authoritative information, consult the
          City of Fort Lauderdale permit records and the Broward County Property
          Appraiser.
        </p>
      </div>

      <hr className="my-6 border-black" />

      <h3 className="font-bold mb-2 text-base">MISSION STATEMENT</h3>
      <p className="mb-6">
        The Blasé Plaza Archive is a database of strip malls and commercial
        plazas that are slated for demolition, redevelopment, or have otherwise
        closed down. As Broward County grows and zoning changes, these
        properties are disappearing faster than they're being documented. They
        represent a distinct era of commercial development — and a practical
        record of how neighborhoods have changed — but most are torn down
        without any systematic record being kept. This archive focuses on the
        period just before demolition or renovation, when a site shows the most
        information: which units are vacant, how signage and infrastructure have
        degraded, how many tenants have turned over. For sites being renovated
        rather than demolished, the archive tracks how physical changes
        correlate with shifts in population, income, and the types of businesses
        moving in — distinguishing between what's being updated and what's being
        replaced entirely.
      </p>

      <h3 className="font-bold mb-2 text-base">GLOSSARY</h3>
      <p className="mb-4">
        Throughout this project, you will see the following terms used to
        describe and compare each plaza. Together, they form a loose field
        methodology for documenting Broward’s commercial landscape.
      </p>

      <p className="mb-4">
        <strong>Horizon</strong>
        <br />
        How near a plaza is to demolition or major renovation, taken from the
        status of its building permits rather than from prediction. IMMINENT
        marks an issued, active demolition permit; NEAR-TERM an issued
        renovation permit; PROJECTED a permit still in plan review; and EXPIRED
        a permit whose work has been completed or has lapsed.
      </p>

      <p className="mb-4">
        <strong>Status</strong>
        <br />
        The plaza’s standing in the archive, restated in plain terms from its
        Horizon. Demolition Pending accompanies an IMMINENT horizon; Renovation
        Pending a NEAR-TERM one; Declining a PROJECTED one; and
        Post-Intervention an EXPIRED one, meaning the permitted work has been
        completed or the permit has lapsed.
      </p>

      <p className="mb-4">
        <strong>Classification</strong>
        <br />
        The plaza’s general type, based on recurring characteristics including
        scale, layout, architecture, relationship to the road, and organization
        of storefronts.
      </p>

      <p className="mb-4">
        <strong>Metrical Assessment</strong>
        <br />A standardized set of observational measures used to compare
        plazas, including qualities such as parking entropy, shade coverage,
        signage density, vacancy, and pedestrian activity. These are comparative
        field observations rather than conventional scientific measurements.
      </p>

      <p className="mb-4">
        <strong>Commercial Species Observed</strong>
        <br />
        The dominant types of businesses found within the plaza at the time of
        observation. Businesses are treated as “species” within a larger
        commercial ecosystem, allowing patterns to emerge across different
        sites.
      </p>

      <p className="mb-6">
        <strong>Secondary Species</strong>
        <br />
        Businesses present within the plaza that are less prevalent or less
        defining of its overall commercial character, but contribute to the
        particular makeup of the site.
      </p>

      <hr className="my-6 border-black" />

      <div className="text-center text-xs text-gray-700 font-bold">
        <p>SYSTEM ADMIN: K.BURGE</p>
      </div>
    </div>
  );
}
