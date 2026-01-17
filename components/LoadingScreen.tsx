import React from 'react';
import { Cpu, Zap, Activity } from 'lucide-react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-center p-6 select-none terminal-font">
            {/* Background Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />

            {/* Tetris Block Animation */}
            <div className="relative mb-8 h-24 w-24">
                <div className="absolute top-0 left-0 w-8 h-8 bg-indigo-500 rounded-sm border border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[bounce_2s_infinite_ease-in-out]" />
                <div className="absolute top-0 left-8 w-8 h-8 bg-indigo-500 rounded-sm border border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[bounce_2s_infinite_0.2s_ease-in-out]" />
                <div className="absolute top-8 left-8 w-8 h-8 bg-indigo-500 rounded-sm border border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[bounce_2s_infinite_0.4s_ease-in-out]" />
                <div className="absolute top-8 left-16 w-8 h-8 bg-indigo-500 rounded-sm border border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[bounce_2s_infinite_0.6s_ease-in-out]" />
            </div>

            <div className="relative z-10 text-center">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                    <Cpu className="w-8 h-8 text-indigo-400 animate-spin-slow" />
                    ML TETRIS
                </h1>
                <p className="text-indigo-400/80 mb-8 font-mono tracking-widest text-sm uppercase">
                    Neural Synchronization in Progress
                </p>

                {/* Progress Indicators */}
                <div className="space-y-4 w-64">
                    <div className="flex items-center gap-3 text-xs text-indigo-300/60 font-mono">
                        <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />
                        <span>Connecting to Cloudflare KV...</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-indigo-300/60 font-mono">
                        <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span>Restoring Genetic Lineage...</span>
                    </div>
                </div>

                {/* Main Progress Bar Wrapper */}
                <div className="mt-8 w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-[progress_3s_infinite_linear]" />
                </div>
            </div>

            {/* Micro-animations in CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(-20%); }
                    100% { transform: translateX(100%); }
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                }
                .terminal-font {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                }
            `}} />
        </div>
    );
};

export default LoadingScreen;
