'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { motion } from 'framer-motion';

export const HeroInterface3D: React.FC = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '2000px' }}>
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-legal-amber/20 blur-[100px] rounded-full pointer-events-none"></div>

      <motion.div
        initial={{ rotateX: 10, rotateY: -15, opacity: 0, x: 50 }}
        animate={{ rotateX: 5, rotateY: -15, opacity: 1, x: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative w-full max-w-[650px] aspect-[4/3] bg-[#0f0f0f]/95 backdrop-blur-xl border border-stone-800 rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col md:flex-row group transform transition-transform duration-700 hover:rotate-y-0 hover:rotate-x-0"
        style={{ transformStyle: 'preserve-3d' }}
      >
         {/* Top Chrome */}
         <div className="absolute top-0 left-0 right-0 h-8 bg-[#151515] border-b border-stone-800 flex items-center px-4 gap-2 z-20">
            <div className="flex gap-1.5 opacity-50">
                <div className="w-2.5 h-2.5 rounded-full bg-stone-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-stone-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-stone-700"></div>
            </div>
            <div className="ml-4 px-3 py-0.5 bg-stone-900 rounded-[2px] border border-stone-800 text-[10px] text-stone-500 font-mono flex-1 text-center truncate">
                bureaucracy-decoder.ai/session/8492
            </div>
         </div>

         {/* Left Panel: Chat Interface */}
         <div className="flex-1 p-6 pt-14 border-r border-stone-800 bg-gradient-to-b from-[#0a0a0a] to-[#111111] relative z-10 flex flex-col">
             <div className="space-y-6">
                 {/* User Query */}
                 <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-[10px] font-serif text-stone-400 shrink-0">
                        U
                    </div>
                    <div>
                        <div className="text-stone-500 text-[10px] font-bold tracking-widest uppercase mb-1">Inquiry</div>
                        <p className="text-stone-200 font-serif text-sm md:text-base leading-snug">
                            "What are the parking requirements for a 40,000 sq ft C5 mixed-use project?"
                        </p>
                    </div>
                 </div>

                 {/* AI Response */}
                 <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-legal-amber/10 border border-legal-amber/30 flex items-center justify-center text-[10px] font-serif text-legal-amber shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                        AI
                    </div>
                    <div className="flex-1">
                        <div className="text-legal-amber text-[10px] font-bold tracking-widest uppercase mb-1">Verdict</div>
                        <div className="bg-stone-900/50 rounded-lg border border-stone-800 p-3 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-green-400 font-bold text-[10px] uppercase tracking-wide">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                Calculation Complete
                            </div>
                            <p className="text-stone-300 text-xs md:text-sm leading-relaxed mb-2">
                                For commercial uses in the C5 zone, code requires <strong className="text-white">1 space per 500 sq ft</strong>.
                            </p>
                            <p className="text-stone-400 text-xs leading-relaxed mb-3">
                                Total Required: <span className="text-legal-amber">80 Spaces</span>.
                            </p>
                            
                            <div className="inline-flex items-center gap-2 px-2 py-1 bg-legal-amber/10 text-legal-amber rounded text-[10px] font-mono border border-legal-amber/20">
                                <span>SEC 12.21 LINKED</span>
                            </div>
                        </div>
                    </div>
                 </div>
             </div>
         </div>

         {/* Right Panel: Evidence (Visible on MD+) */}
         <div className="hidden md:block w-[240px] shrink-0 p-6 pt-14 bg-[#0c0c0c] relative z-10 border-l border-stone-800">
             <div className="absolute top-12 right-4 px-1.5 py-0.5 bg-stone-900 text-[8px] font-mono text-stone-500 border border-stone-800 rounded">
                EVIDENCE
             </div>
             
             <div className="space-y-4 mt-2">
                 <div className="font-mono text-[10px] text-stone-600 border-b border-stone-800 pb-2 mb-2">
                    SEC. 12.21 {'>'} PARKING
                 </div>
                 
                 <div className="font-serif text-stone-300 space-y-3 opacity-90 text-xs leading-6">
                    <div>
                        <h4 className="font-bold text-stone-100 text-sm mb-1 flex items-center gap-2">
                            [SEC. 12.21.A.4]
                            <span className="w-1.5 h-1.5 rounded-full bg-legal-amber shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
                        </h4>
                    </div>
                    
                    <div className="pl-3 border-l-2 border-legal-amber/50">
                        <p className="text-stone-400">
                            (c) For commercial and industrial buildings...
                        </p>
                        <p className="text-stone-200 mt-2">
                            (1) For every <span className="bg-legal-amber/20 text-legal-amber px-1 rounded-[2px]">500 square feet</span> of gross floor area, there shall be at least one parking space.
                        </p>
                    </div>
                 </div>
                 
                 {/* Fade out bottom */}
                 <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0c0c0c] to-transparent pointer-events-none"></div>
             </div>
         </div>

         {/* Reflective Sheen Overlay */}
         <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-20 pointer-events-none"></div>
      </motion.div>
    </div>
  );
};