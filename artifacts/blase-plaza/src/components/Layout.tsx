import React from "react";
import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#c0c0c0] font-sans text-black">
      {/* @ts-expect-error marquee is deprecated but required by design */}
      <marquee className="bg-black text-[#ffffaa] font-bold py-1 border-b-2 border-white text-sm" scrollamount="5">
        ** RECORDS UPDATED DAILY **
      </marquee>
      
      <header className="bg-[#000080] text-white p-3 flex justify-between items-center border-b-2 border-white border-t-2 border-[#808080]">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-widest" style={{ textShadow: "1px 1px 0px #000" }}>BLASÉ PLAZA ARCHIVES</h1>
            <p className="text-sm text-[#ffffaa] uppercase tracking-widest">Miami-Dade County</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 p-4 gap-4 max-w-7xl mx-auto w-full">
        <aside className="w-40 flex-shrink-0 flex flex-col gap-4">
          <div className="win98-window p-3" style={{ overflow: "hidden" }}>
            <p className="font-bold text-sm mb-3 pb-1 border-b-2 border-[#808080]">NAVIGATION</p>
            <ul className="flex flex-col gap-2 text-sm">
              <li><Link href="/"><span className={`cursor-pointer whitespace-nowrap ${location === '/' ? 'font-bold' : ''}`}>[ HOME ]</span></Link></li>
              <li><Link href="/map"><span className={`cursor-pointer whitespace-nowrap ${location === '/map' ? 'font-bold' : ''}`}>[ MAP ]</span></Link></li>
              <li><Link href="/list"><span className={`cursor-pointer whitespace-nowrap ${location === '/list' ? 'font-bold' : ''}`}>[ LIST VIEW ]</span></Link></li>
              <li><Link href="/about"><span className={`cursor-pointer whitespace-nowrap ${location === '/about' ? 'font-bold' : ''}`}>[ ABOUT ]</span></Link></li>
              <li><Link href="/api-access"><span className={`cursor-pointer whitespace-nowrap ${location === '/api-access' ? 'font-bold' : ''}`}>[ API ACCESS ]</span></Link></li>
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
