import React from "react";
import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navLinkClass = (path: string) =>
    `cursor-pointer whitespace-nowrap ${location === path ? "font-bold" : ""}`;

  const mobileNavClass = (path: string) =>
    `block px-4 py-3 text-sm whitespace-nowrap cursor-pointer border-r border-[#808080] min-w-max ${
      location === path ? "font-bold bg-[#c0c0c0]" : ""
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#c0c0c0] font-sans text-black">
      <div className="bg-black text-[#ffffaa] font-bold py-1 border-b-2 border-white text-xs md:text-sm overflow-hidden whitespace-nowrap">
        <span style={{ display: "inline-block", animation: "marquee-scroll 18s linear infinite" }}>
          ** BLASÉ PLAZA ARCHIVES //&nbsp;&nbsp;RECORDS UPDATED DAILY **
          <span style={{ display: "inline-block", minWidth: "100vw" }} />
          ** BLASÉ PLAZA ARCHIVES //&nbsp;&nbsp;RECORDS UPDATED DAILY **
          <span style={{ display: "inline-block", minWidth: "100vw" }} />
        </span>
      </div>
      
      <header className="bg-[#000080] text-white p-2 md:p-3 flex justify-between items-center border-b-2 border-white border-t-2 border-[#808080]">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base md:text-xl font-bold tracking-widest leading-tight" style={{ textShadow: "1px 1px 0px #000" }}>BLASÉ PLAZA ARCHIVES</h1>
            <p className="text-xs md:text-sm text-[#ffffaa] uppercase tracking-widest">Broward County</p>
          </div>
        </div>
      </header>

      {/* Mobile-only horizontal nav bar */}
      <nav className="flex md:hidden bg-[#d4d0c8] border-b-2 border-[#808080] overflow-x-auto">
        <Link href="/"><span className={mobileNavClass("/")}>[ HOME ]</span></Link>
        <Link href="/map"><span className={mobileNavClass("/map")}>[ MAP ]</span></Link>
        <Link href="/list"><span className={mobileNavClass("/list")}>[ LIST ]</span></Link>
        <Link href="/about"><span className={mobileNavClass("/about")}>[ ABOUT ]</span></Link>
        <Link href="/api-access"><span className={`block px-4 py-3 text-sm whitespace-nowrap cursor-pointer min-w-max ${location === "/api-access" ? "font-bold bg-[#c0c0c0]" : ""}`}>[ API ]</span></Link>
      </nav>

      <div className="flex flex-1 p-2 md:p-4 gap-4 max-w-7xl mx-auto w-full">
        {/* Sidebar — hidden on mobile, visible on md+ */}
        <aside className="hidden md:flex w-40 flex-shrink-0 flex-col gap-4">
          <div className="win98-window p-3" style={{ overflow: "hidden" }}>
            <p className="font-bold text-sm mb-3 pb-1 border-b-2 border-[#808080]">NAVIGATION</p>
            <ul className="flex flex-col gap-2 text-sm">
              <li><Link href="/"><span className={navLinkClass("/")} >[ HOME ]</span></Link></li>
              <li><Link href="/map"><span className={navLinkClass("/map")}>[ MAP ]</span></Link></li>
              <li><Link href="/list"><span className={navLinkClass("/list")}>[ LIST VIEW ]</span></Link></li>
              <li><Link href="/about"><span className={navLinkClass("/about")}>[ ABOUT ]</span></Link></li>
              <li><Link href="/api-access"><span className={navLinkClass("/api-access")}>[ API ACCESS ]</span></Link></li>
            </ul>
          </div>
        </aside>

        <main className="flex-1 bg-[#c0c0c0] min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
