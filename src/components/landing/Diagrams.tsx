'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, FileText, Scale, AlertCircle, Clock, ChevronRight } from 'lucide-react';

// --- INTERFACE MOCKUP ---
export const InterfaceMockup: React.FC = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
        setStep(1);
        setTimeout(() => setStep(2), 1500);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-5xl mx-auto my-8">
      
      {/* Left: The Chat / Query Interface */}
      <div className="flex-1 bg-stone-900 rounded-sm border border-stone-800 shadow-2xl p-8 relative overflow-hidden min-h-[400px]">
         <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-legal-orange to-legal-amber opacity-70"></div>
         
         <div className="mb-8 pb-4 border-b border-stone-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Scale size={16} className="text-stone-500"/>
                <span className="font-serif text-lg text-stone-300">Case File #2025-COMMERCIAL-C5</span>
            </div>
            <span className="text-xs font-bold text-stone-600 tracking-widest uppercase">Confidential</span>
         </div>

         <div className="space-y-6">
            {/* User Query */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-4"
            >
                <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 font-serif text-sm shrink-0 border border-stone-700">Q</div>
                <div className="flex-1">
                    <p className="font-serif text-xl text-stone-200 leading-relaxed">
                        "What are the parking requirements for a 40,000 sq ft C5 mixed-use project?"
                    </p>
                </div>
            </motion.div>

            {/* AI Thinking/Response */}
            {step >= 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4"
                >
                    <div className="w-8 h-8 rounded-full bg-legal-amber/10 flex items-center justify-center text-legal-amber font-serif text-sm shrink-0 border border-legal-amber/20">A</div>
                    <div className="flex-1 space-y-4">
                        {step === 1 ? (
                            <div className="flex items-center gap-2 text-sm text-stone-500 animate-pulse">
                                <div className="w-2 h-2 bg-legal-amber rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                                Scanning Municipal Code (Vol I-IX)...
                            </div>
                        ) : (
                            <>
                                <p className="text-stone-300 leading-relaxed">
                                    For commercial uses in the C5 zone, code requires <strong className="text-white">1 space per 500 sq ft</strong>.
                                </p>
                                <p className="text-stone-300 leading-relaxed">
                                    Total Required: <strong className="text-white">80 Spaces</strong>.
                                </p>

                                {/* Footnotes Style */}
                                <div className="mt-4 pt-4 border-t border-stone-800">
                                    <div className="flex items-start gap-2 text-xs text-stone-500 mb-2 hover:bg-stone-800/50 p-2 rounded transition-colors cursor-pointer border-l-2 border-transparent hover:border-legal-amber">
                                        <span className="text-legal-amber font-bold">[1]</span>
                                        <span>SEC. 12.21.A.4(c) — Commercial and Industrial Parking</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
         </div>
      </div>

      {/* Right: The Citation Panel / "Evidence" */}
      <div className="lg:w-80 shrink-0">
         <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: step === 2 ? 1 : 0.5, x: step === 2 ? 0 : 20 }}
            className="bg-stone-900 border border-stone-800 p-6 h-full relative shadow-inner"
         >
            <div className="absolute -top-3 left-6 px-2 bg-stone-900 text-xs font-bold text-stone-500 tracking-widest uppercase border border-stone-800">Source Text</div>
            
            {step === 2 ? (
                <div className="font-serif text-stone-300 space-y-4 text-sm leading-loose">
                    <div className="text-legal-amber font-bold text-xs uppercase tracking-widest mb-1">Excerpts from LAMC § 12.21.A.4</div>
                    <p className="bg-legal-amber/10 px-1 -mx-1 rounded-sm inline box-decoration-clone border-b border-legal-amber/20 text-stone-200">
                        "For commercial and industrial buildings... at least one parking space for each 500 square feet of gross floor area..."
                    </p>
                    <p className="text-stone-500 text-xs mt-4">
                        (Off-Street Parking Requirements)
                    </p>
                </div>
            ) : (
                <div className="space-y-3 opacity-20">
                    <div className="h-2 bg-stone-700 rounded w-3/4"></div>
                    <div className="h-2 bg-stone-700 rounded w-full"></div>
                    <div className="h-2 bg-stone-700 rounded w-5/6"></div>
                    <div className="h-2 bg-stone-700 rounded w-full"></div>
                </div>
            )}
         </motion.div>
      </div>

    </div>
  );
};


// --- COMPLIANCE METRIC CHART ---
export const ComplianceMetricDiagram: React.FC = () => {
    // Comparison: Manual Review vs Bureaucracy Decoder
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center p-8 bg-stone-900 border border-stone-800 rounded-sm shadow-xl my-8">
            <div>
                <h3 className="font-serif text-2xl mb-4 text-stone-100">Velocity of Compliance</h3>
                <p className="text-stone-400 text-lg mb-6 leading-relaxed">
                    Complex zoning inquiries typically require hours of manual cross-referencing. Our reasoning engine reduces this to seconds while increasing citation accuracy.
                </p>
                
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-sm text-stone-500">
                        <AlertCircle size={16} className="text-stone-600"/>
                        <span>Drastic reduction in "Correction Letters"</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-stone-400">
                        <CheckCircle size={16} className="text-legal-amber"/>
                        <span>Direct linkage to municipal code amendments</span>
                    </div>
                </div>
            </div>
            
            <div className="bg-[#151515] p-8 border border-stone-800 relative">
                <div className="space-y-6">
                    {/* Bar 1 */}
                    <div>
                        <div className="flex justify-between text-xs font-bold tracking-widest text-stone-500 mb-2 uppercase">
                            <span>Manual Feasibility Study</span>
                            <span>~4.5 Hours</span>
                        </div>
                        <div className="w-full h-12 bg-stone-800 rounded-sm relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 w-full bg-stone-700 flex items-center px-4 text-stone-400 text-xs">
                                <Clock size={14} className="mr-2"/> Human Paralegal
                            </div>
                        </div>
                    </div>

                    {/* Bar 2 */}
                    <div>
                        <div className="flex justify-between text-xs font-bold tracking-widest text-stone-500 mb-2 uppercase">
                            <span>AI Compliance Check</span>
                            <span className="text-legal-orange">~0.8 Seconds</span>
                        </div>
                        <div className="w-full h-12 bg-legal-orange/10 rounded-sm relative overflow-hidden border border-legal-orange/20 shadow-[0_0_15px_rgba(234,88,12,0.1)]">
                            <motion.div 
                                initial={{ width: 0 }}
                                whileInView={{ width: '2%' }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="absolute inset-y-0 left-0 bg-legal-orange flex items-center px-4 overflow-visible whitespace-nowrap text-white text-xs font-bold"
                            >
                                
                            </motion.div>
                            <div className="absolute inset-0 flex items-center px-4 text-legal-orange font-bold text-xs">
                                AI Reasoning Engine
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-6 text-center">
                     <div className="inline-block px-3 py-1 bg-green-900/30 text-green-400 border border-green-800/50 text-xs font-bold rounded-full">
                        99.9% Cost Reduction
                     </div>
                </div>
            </div>
        </div>
    )
}