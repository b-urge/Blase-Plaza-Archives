export default function About() {
  return (
    <div className="win98-window p-8 h-full max-w-3xl font-mono text-[13px] leading-relaxed">
      <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">ABOUT BLASÉ PLAZA ARCHIVES</h2>
      
      <p className="mb-4">
        <strong>ESTABLISHED:</strong> 1997<br />
        <strong>JURISDICTION:</strong> Miami-Dade County<br />
        <strong>DEPARTMENT:</strong> Office of Unincorporated Commercial Redevelopment
      </p>

      <hr className="my-6 border-black" />

      <h3 className="font-bold mb-2 text-base">MISSION STATEMENT</h3>
      <p className="mb-6">
        The Blasé Plaza Archives serves as the official operational repository for documenting commercial retail 
        structures—colloquially known as "strip malls" or "plazas"—that are scheduled for demolition, major 
        redevelopment, or have otherwise reached the end of their viable economic lifespan. 
      </p>

      <p className="mb-6">
        As the county expands and density requirements shift, these transitional spaces provide crucial data 
        points regarding mid-to-late 20th century commercial planning, asphalt decay rates, and localized economic micro-climates.
      </p>

      <h3 className="font-bold mb-2 text-base">DATA COLLECTION METHODOLOGY</h3>
      <p className="mb-6">
        Field agents dispatch weekly to slated sites to record vital metrics including parking entropy, 
        shade coverage (artificial and natural), remaining signage density, and overall structural malaise. 
        Photographic evidence is currently maintained in physical filing cabinets off-site; this digital terminal 
        only reflects quantitative metrics and qualitative field notes.
      </p>

      <h3 className="font-bold mb-2 text-base">ACCESS RESTRICTIONS</h3>
      <div className="bg-black text-[#ffffaa] p-4 mb-6 border-2 border-red-600 font-bold text-center">
        UNAUTHORIZED ACCESS OR DISTRIBUTION OF THESE RECORDS IS STRICTLY PROHIBITED.<br/>
        VIOLATORS WILL BE PROSECUTED UNDER COUNTY ORDINANCE 4A-1995.
      </div>

      <hr className="my-6 border-black" />
      
      <div className="text-center text-xs text-gray-700 font-bold">
        <p>SYSTEM ADMIN: R. HERNANDEZ</p>
        <p>LAST MAINTENANCE CYCLE: 04/12/2001</p>
      </div>
    </div>
  );
}
