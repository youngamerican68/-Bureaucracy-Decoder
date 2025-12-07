'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ComplianceMetricDiagram } from '@/components/landing/Diagrams';
import { AnimatedDemo } from '@/components/landing/AnimatedDemo';
import { Menu, X, Scale, Building2, ScrollText, ShieldCheck, Database, Zap, MessageSquare } from 'lucide-react';

const TeamMember = ({ name, role, delay }: { name: string, role: string, delay: string }) => {
  return (
    <div className="flex flex-col group items-start p-6 bg-transparent border-l border-stone-800 hover:border-legal-amber transition-all duration-300 w-64" style={{ animationDelay: delay }}>
      <h3 className="font-serif text-xl text-stone-100 mb-2 group-hover:text-legal-amber transition-colors">{name}</h3>
      <p className="text-xs text-stone-500 font-bold uppercase tracking-widest leading-relaxed">{role}</p>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-50 selection:bg-legal-orange selection:text-white overflow-x-hidden">

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-legal-dark/95 backdrop-blur-md border-b border-stone-800 py-4' : 'bg-transparent py-6 lg:py-8'}`}>
        <div className="container mx-auto px-6 lg:px-12 flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-8 h-8 bg-stone-100 flex items-center justify-center text-stone-900 font-serif text-lg shadow-sm">
              <Scale size={16} />
            </div>
            <span className={`font-serif font-bold text-lg tracking-wide text-stone-100 transition-opacity ${scrolled ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>
              BUREAUCRACY <span className="font-normal text-stone-500">DECODER</span>
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-10 text-xs font-bold tracking-[0.15em] text-stone-400">
            <a href="#introduction" onClick={scrollToSection('introduction')} className="hover:text-legal-amber transition-colors cursor-pointer uppercase">The Problem</a>
            <a href="#interface" onClick={scrollToSection('interface')} className="hover:text-legal-amber transition-colors cursor-pointer uppercase">The System</a>
            <a href="#impact" onClick={scrollToSection('impact')} className="hover:text-legal-amber transition-colors cursor-pointer uppercase">Impact</a>
            <Link
              href="/chat"
              className="px-6 py-2 bg-gradient-to-r from-legal-orange to-amber-600 text-white rounded-sm hover:opacity-90 transition-opacity shadow-sm shadow-orange-900/20 cursor-pointer border border-orange-500/20 flex items-center gap-2"
            >
              <MessageSquare size={14} />
              TRY CHAT
            </Link>
          </div>

          <button className="lg:hidden text-stone-100 p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-legal-dark flex flex-col items-center justify-center gap-8 text-xl font-serif animate-fade-in">
            <a href="#introduction" onClick={scrollToSection('introduction')} className="hover:text-legal-amber transition-colors cursor-pointer text-stone-100">The Problem</a>
            <a href="#interface" onClick={scrollToSection('interface')} className="hover:text-legal-amber transition-colors cursor-pointer text-stone-100">The System</a>
            <a href="#impact" onClick={scrollToSection('impact')} className="hover:text-legal-amber transition-colors cursor-pointer text-stone-100">Impact</a>
        </div>
      )}

      {/* Hero Section - 2 Column Layout */}
      <header className="relative pt-28 lg:pt-40 pb-16 lg:pb-32 overflow-hidden min-h-[90vh] flex items-center">
        {/* Background Grids */}
        <div className="absolute inset-0 z-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-legal-dark via-transparent to-legal-dark pointer-events-none"></div>

        <div className="container mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">

          {/* Left Column: The Hook */}
          <div className="flex flex-col items-start text-left max-w-xl mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1 border border-amber-500/30 text-amber-500 text-[10px] tracking-[0.2em] uppercase font-bold rounded-full bg-amber-900/10 backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></span>
              Los Angeles Zoning Copilot
            </div>

            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.1] mb-6 text-stone-100 drop-shadow-2xl tracking-tight">
              Know LA Zoning Rules Before You Draw the Lines.
            </h1>

            <p className="text-lg md:text-xl text-stone-400 font-light leading-relaxed mb-10 border-l-2 border-stone-800 pl-6">
              An AI copilot trained on the Los Angeles Municipal Code. Get instant, cited answers to zoning questions — parking ratios, setbacks, height limits, ADU rules — without digging through 400-page PDFs.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-5 mb-6 w-full sm:w-auto">
               <Link
                href="/chat"
                className="px-8 py-4 bg-gradient-to-r from-legal-orange to-amber-600 text-white text-sm font-bold tracking-[0.1em] uppercase rounded-sm hover:scale-105 transition-transform shadow-[0_0_30px_rgba(234,88,12,0.3)] cursor-pointer border border-orange-400/30 text-center sm:text-left flex items-center justify-center gap-2"
              >
                <MessageSquare size={18} />
                Try LA Zoning Chat
              </Link>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-stone-500 mb-8 max-w-md leading-relaxed">
              Informational only — not legal advice. Results may be incomplete. Verify with{' '}
              <a href="https://codelibrary.amlegal.com/codes/los_angeles" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">official sources</a>.{' '}
              <Link href="/terms" className="text-amber-500 hover:underline">Terms of Use</Link>
            </p>

            {/* For: line */}
            <div className="flex items-center gap-3 mb-8">
              <span className="text-xs text-stone-500 uppercase tracking-wider">For:</span>
              <div className="flex gap-2">
                <span className="text-xs px-3 py-1 bg-stone-800/50 border border-stone-700 rounded-full text-stone-400">Architects</span>
                <span className="text-xs px-3 py-1 bg-stone-800/50 border border-stone-700 rounded-full text-stone-400">Developers</span>
                <span className="text-xs px-3 py-1 bg-stone-800/50 border border-stone-700 rounded-full text-stone-400">Land-Use Attorneys</span>
              </div>
            </div>

            {/* Trust Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 w-full border-t border-stone-800/50 pt-8">
               <div className="flex items-center gap-2 text-stone-500">
                  <ShieldCheck size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">LAMC CHAPTERS I, 1A, IX</span>
                      <span className="text-[9px] text-stone-600">Full coverage</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 text-stone-500">
                  <Database size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">1,400+ SECTIONS</span>
                      <span className="text-[9px] text-stone-600">Indexed & searchable</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 text-stone-500">
                  <Zap size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">CITED ANSWERS</span>
                      <span className="text-[9px] text-stone-600">§12.21, §12.14, etc.</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 text-stone-500">
                  <Scale size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">HYBRID RAG</span>
                      <span className="text-[9px] text-stone-600">Vector + keyword search</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Column: The Proof (Visual) */}
          <div className="relative h-full w-full flex items-center justify-center lg:justify-end">
            <div className="absolute inset-0 bg-gradient-to-l from-legal-dark/50 to-transparent z-20 pointer-events-none lg:hidden"></div>
             {/* Animated demo showing real app interface */}
             <div className="w-full relative z-10">
                <AnimatedDemo />
             </div>
          </div>

        </div>
      </header>

      <main>
        {/* Introduction: The Regulatory Maze */}
        <section id="introduction" className="py-24 bg-legal-dark border-t border-stone-900 relative">
          <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-4">
              <div className="inline-block mb-4 text-xs font-bold tracking-widest text-stone-500 uppercase border-b border-legal-amber/50 pb-1 text-legal-amber">The Challenge</div>
              <h2 className="font-serif text-4xl mb-6 leading-tight text-stone-100">The Complexity of Compliance</h2>
            </div>
            <div className="md:col-span-8 text-lg text-stone-400 leading-relaxed space-y-6">
              <p>
                <span className="text-6xl float-left mr-4 mt-[-12px] font-serif text-legal-amber opacity-80">L</span>os Angeles zoning lives across hundreds of pages of LAMC Chapter I, plus overlays, specific plans, and ordinances that don&apos;t show up in a simple zone label. Chapter 1A covers Downtown. Chapter IX is the Building Code.
              </p>

              {/* Proof points */}
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <li className="flex items-center gap-2 text-stone-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-legal-amber"></span>
                  400+ pages of base code
                </li>
                <li className="flex items-center gap-2 text-stone-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-legal-amber"></span>
                  Dozens of specific plans
                </li>
                <li className="flex items-center gap-2 text-stone-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-legal-amber"></span>
                  Frequent amendments
                </li>
              </ul>

              <p>
                <strong className="text-stone-100 font-medium">We&apos;ve ingested and structured all three chapters</strong> — over 1,400 sections — so you can ask questions in plain language and get back the relevant code sections with exact citations like <span className="text-legal-amber">§12.21.A.4</span> or <span className="text-legal-amber">§12.14.C.1</span>, not guesswork.
              </p>
            </div>
          </div>
        </section>

        {/* The System: Interface Mockup */}
        <section id="interface" className="py-24 bg-legal-card relative overflow-hidden border-t border-stone-900">
            {/* Subtle Grid Background */}
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.2] pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-legal-dark via-transparent to-legal-dark pointer-events-none opacity-80"></div>

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-900 text-stone-400 text-xs font-bold tracking-widest uppercase rounded-full mb-6 border border-stone-800 shadow-sm">
                        <ScrollText size={14} className="text-legal-amber"/> Hybrid RAG Search
                    </div>
                    <h2 className="font-serif text-4xl md:text-5xl mb-4 text-stone-100">From Query to Citation</h2>
                    <p className="text-stone-500 max-w-xl mx-auto">Ask about parking in C2, setbacks in R1, or ADU rules — get the exact LAMC section with cited text.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    <div className="p-6 bg-stone-900/50 border border-stone-800 backdrop-blur-sm hover:border-stone-700 transition-colors">
                        <h4 className="font-serif text-lg mb-2 text-stone-100">Ask a Real Question</h4>
                        <p className="text-sm text-stone-500 leading-relaxed mb-3">Type your zoning question in plain English.</p>
                        <code className="text-xs bg-stone-800 text-amber-400 px-2 py-1 rounded font-mono">&quot;What&apos;s the max FAR in C2-1?&quot;</code>
                    </div>
                    <div className="p-6 bg-stone-900/50 border border-stone-800 backdrop-blur-sm hover:border-stone-700 transition-colors">
                        <h4 className="font-serif text-lg mb-2 text-stone-100">Get the Relevant Code</h4>
                        <p className="text-sm text-stone-500 leading-relaxed mb-3">We retrieve the exact LAMC section with context.</p>
                        <code className="text-xs bg-stone-800 text-amber-400 px-2 py-1 rounded font-mono">§12.21.1.A.1</code>
                    </div>
                    <div className="p-6 bg-stone-900/50 border border-stone-800 backdrop-blur-sm hover:border-stone-700 transition-colors">
                        <h4 className="font-serif text-lg mb-2 text-stone-100">Verify & Validate</h4>
                        <p className="text-sm text-stone-500 leading-relaxed">Click through to amlegal.com to confirm. Check overlays, specific plans, and site conditions.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* Impact: Performance */}
        <section id="impact" className="py-24 bg-legal-dark border-t border-stone-900">
             <div className="container mx-auto px-6">
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h2 className="font-serif text-4xl md:text-5xl mb-6 text-stone-100">Accelerate Your Research</h2>
                    <div className="w-24 h-1 bg-legal-orange mx-auto opacity-50"></div>
                </div>

                <div className="max-w-4xl mx-auto">
                    <ComplianceMetricDiagram />
                </div>

                 <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
                     <div className="flex gap-4">
                         <div className="shrink-0 w-12 h-12 bg-legal-amber/10 flex items-center justify-center text-legal-amber rounded-sm border border-legal-amber/20">
                             <Building2 size={24} />
                         </div>
                         <div>
                             <h4 className="font-serif text-xl mb-2 text-stone-100">Faster Initial Research</h4>
                             <p className="text-stone-400 text-sm leading-relaxed">
                                 Get quick, cited answers to common zoning questions. Use as a starting point for feasibility research — always verify with official sources.
                             </p>
                         </div>
                     </div>
                     <div className="flex gap-4">
                         <div className="shrink-0 w-12 h-12 bg-legal-orange/10 flex items-center justify-center text-legal-orange rounded-sm border border-legal-orange/20">
                             <Scale size={24} />
                         </div>
                         <div>
                             <h4 className="font-serif text-xl mb-2 text-stone-100">Code Navigation Aid</h4>
                             <p className="text-stone-400 text-sm leading-relaxed">
                                 Find relevant LAMC sections faster. We help you locate the right code sections — you make the final determination.
                             </p>
                         </div>
                     </div>
                 </div>
             </div>
        </section>

      </main>

      <footer className="bg-stone-950 text-stone-400 py-20 border-t border-stone-900">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-12">
            <div>
                <div className="text-stone-100 font-serif font-bold text-3xl mb-4">Bureaucracy Decoder</div>
                <p className="text-sm max-w-xs leading-relaxed text-stone-600 mb-4">
                    AI-powered zoning code research for architects, developers, and land-use professionals.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border border-amber-500/30 rounded-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-bold tracking-wider text-amber-500">CURRENTLY LIVE: LOS ANGELES</span>
                </div>
            </div>

            <div className="flex gap-12 text-xs tracking-widest font-bold uppercase text-stone-600">
                <div className="flex flex-col gap-4">
                    <span className="text-stone-100">Coverage</span>
                    <span className="text-stone-500">LAMC Chapter I (Zoning)</span>
                    <span className="text-stone-500">LAMC Chapter 1A (Downtown)</span>
                    <span className="text-stone-500">LAMC Chapter IX (Building)</span>
                </div>
                <div className="flex flex-col gap-4">
                    <span className="text-stone-100">Coming Soon</span>
                    <span className="text-stone-600">San Francisco</span>
                    <span className="text-stone-600">New York City</span>
                    <span className="text-stone-600">More cities...</span>
                </div>
            </div>
        </div>
        <div className="container mx-auto px-6 mt-16 pt-8 border-t border-stone-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-stone-700">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <span>© 2025 Leafspire LLC · Pennsylvania</span>
              <span className="hidden sm:inline text-stone-800">·</span>
              <span>Informational only — not legal advice. Verify with official sources.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-stone-500 hover:text-amber-500 transition-colors">Terms of Use</Link>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
