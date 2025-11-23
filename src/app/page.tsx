'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { HeroInterface3D } from '@/components/landing/QuantumScene';
import { InterfaceMockup, ComplianceMetricDiagram } from '@/components/landing/Diagrams';
import { Menu, X, Scale, Building2, ScrollText, ShieldCheck, Database, Zap, PlayCircle, Lock } from 'lucide-react';

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
              href="/dashboard"
              className="px-6 py-2 bg-gradient-to-r from-legal-orange to-amber-600 text-white rounded-sm hover:opacity-90 transition-opacity shadow-sm shadow-orange-900/20 cursor-pointer border border-orange-500/20"
            >
              REQUEST ACCESS
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
              Municipal Intelligence v2.0
            </div>

            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.1] mb-6 text-stone-100 drop-shadow-2xl tracking-tight">
              Know the Rules Before You Draw the Lines.
            </h1>

            <p className="text-lg md:text-xl text-stone-400 font-light leading-relaxed mb-10 border-l-2 border-stone-800 pl-6">
              The ultimate pre-design intelligence tool. Instantly identify height limits, setbacks, and use permissions so you never design a non-compliant building.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-5 mb-12 w-full sm:w-auto">
               <Link
                href="/dashboard"
                className="px-8 py-4 bg-gradient-to-r from-legal-orange to-amber-600 text-white text-sm font-bold tracking-[0.1em] uppercase rounded-sm hover:scale-105 transition-transform shadow-[0_0_30px_rgba(234,88,12,0.3)] cursor-pointer border border-orange-400/30 text-center sm:text-left flex items-center justify-center gap-2"
              >
                Try a Live Zoning Query
              </Link>
              <a
                href="#video"
                className="px-8 py-4 bg-stone-900/50 hover:bg-stone-800 text-stone-300 border border-stone-700 text-sm font-bold tracking-[0.1em] uppercase rounded-sm transition-all cursor-pointer flex items-center justify-center gap-3 group"
              >
                <PlayCircle size={18} className="group-hover:text-legal-amber transition-colors"/>
                Watch Workflow (30s)
              </a>
            </div>

            {/* Trust Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 w-full border-t border-stone-800/50 pt-8">
               <div className="flex items-center gap-2 text-stone-500">
                  <ShieldCheck size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">SOURCE-FIRST RETRIEVAL</span>
                      <span className="text-[9px] text-stone-600">Always cited</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 text-stone-500">
                  <Database size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">1.4M+ TOKENS</span>
                      <span className="text-[9px] text-stone-600">Verified Code</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 text-stone-500">
                  <Zap size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">0.8s SPEED</span>
                      <span className="text-[9px] text-stone-600">Retrieval Time</span>
                  </div>
               </div>
               <div className="flex items-center gap-2 text-stone-500">
                  <Scale size={16} className="text-legal-amber shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-stone-400">AUDITABLE</span>
                      <span className="text-[9px] text-stone-600">Full Trail</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Column: The Proof (Visual) */}
          <div className="relative h-full w-full flex items-center justify-center lg:justify-end">
            <div className="absolute inset-0 bg-gradient-to-l from-legal-dark/50 to-transparent z-20 pointer-events-none lg:hidden"></div>
             {/* Negative margin on large screens to pull it right */}
             <div className="w-full lg:w-[120%] lg:-mr-[10%] relative z-10">
                <HeroInterface3D />
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
                <span className="text-6xl float-left mr-4 mt-[-12px] font-serif text-legal-amber opacity-80">U</span>rban development is stifled by the sheer density of municipal codes. The Los Angeles Municipal Code alone spans thousands of pages, filled with cross-references, conditional clauses, and amendments dating back decades.
              </p>
              <p>
                <strong className="text-stone-100 font-medium">Interpreting these regulations burns valuable design hours and introduces liability risk before a project even starts.</strong> <strong className="text-stone-100 font-medium">Bureaucracy Decoder</strong> utilizes advanced natural language understanding to parse, index, and reason over this unstructured legal data, effectively democratizing access to regulatory compliance.
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
                        <ScrollText size={14} className="text-legal-amber"/> Neural Reasoning
                    </div>
                    <h2 className="font-serif text-4xl md:text-5xl mb-4 text-stone-100">From Query to Citation</h2>
                    <p className="text-stone-500 max-w-xl mx-auto">Watch the system analyze a complex zoning query and retrieve the exact legal grounding.</p>
                </div>

                <InterfaceMockup />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-5xl mx-auto">
                    <div className="p-6 bg-stone-900/50 border border-stone-800 backdrop-blur-sm hover:border-stone-700 transition-colors">
                        <h4 className="font-serif text-lg mb-2 text-stone-100">Instant Feasibility Checks</h4>
                        <p className="text-sm text-stone-500 leading-relaxed">Validate parking ratios, FAR, and density bonuses in seconds, not hours.</p>
                    </div>
                    <div className="p-6 bg-stone-900/50 border border-stone-800 backdrop-blur-sm hover:border-stone-700 transition-colors">
                        <h4 className="font-serif text-lg mb-2 text-stone-100">Site Constraint Analysis</h4>
                        <p className="text-sm text-stone-500 leading-relaxed">Identify hidden triggers like Methane Zones or Hillside ordinances before you commit to a site.</p>
                    </div>
                    <div className="p-6 bg-stone-900/50 border border-stone-800 backdrop-blur-sm hover:border-stone-700 transition-colors">
                        <h4 className="font-serif text-lg mb-2 text-stone-100">Verifiable Citations</h4>
                        <p className="text-sm text-stone-500 leading-relaxed">Every assertion is backed by a clickable, verifiable link to the official city code.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* Impact: Performance */}
        <section id="impact" className="py-24 bg-legal-dark border-t border-stone-900">
             <div className="container mx-auto px-6">
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h2 className="font-serif text-4xl md:text-5xl mb-6 text-stone-100">Quantifiable Efficiency</h2>
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
                             <h4 className="font-serif text-xl mb-2 text-stone-100">Accelerated Development</h4>
                             <p className="text-stone-400 text-sm leading-relaxed">
                                 Reducing the "feasibility study" phase from weeks to minutes allows developers to assess viability instantly, unlocking housing supply.
                             </p>
                         </div>
                     </div>
                     <div className="flex gap-4">
                         <div className="shrink-0 w-12 h-12 bg-legal-orange/10 flex items-center justify-center text-legal-orange rounded-sm border border-legal-orange/20">
                             <Scale size={24} />
                         </div>
                         <div>
                             <h4 className="font-serif text-xl mb-2 text-stone-100">Regulatory Transparency</h4>
                             <p className="text-stone-400 text-sm leading-relaxed">
                                 By making the code accessible, we reduce the asymmetry of information between large firms and individual homeowners.
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
                <p className="text-sm max-w-xs leading-relaxed text-stone-600">
                    Decoding the complexity of the modern city through advanced machine learning and legal reasoning.
                </p>
            </div>

            <div className="flex gap-12 text-xs tracking-widest font-bold uppercase text-stone-600">
                <div className="flex flex-col gap-4">
                    <span className="text-stone-100">Platform</span>
                    <a href="#" className="hover:text-legal-amber transition-colors">API Access</a>
                    <a href="#" className="hover:text-legal-amber transition-colors">Documentation</a>
                    <a href="#" className="hover:text-legal-amber transition-colors">Enterprise</a>
                </div>
                <div className="flex flex-col gap-4">
                    <span className="text-stone-100">Company</span>
                    <a href="#" className="hover:text-legal-amber transition-colors">About</a>
                    <a href="#" className="hover:text-legal-amber transition-colors">Careers</a>
                    <a href="#" className="hover:text-legal-amber transition-colors">Contact</a>
                </div>
            </div>
        </div>
        <div className="container mx-auto px-6 mt-16 pt-8 border-t border-stone-900 flex flex-col md:flex-row justify-between items-center text-xs text-stone-700">
            <span>© 2025 Bureaucracy Decoder Inc. All rights reserved.</span>
            <span>Los Angeles • New York • London</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
