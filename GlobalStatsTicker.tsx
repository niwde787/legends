import React, { useEffect, useState } from 'react';
import { subscribeToGlobalStats } from './services/firebase';

const GlobalStatsTicker: React.FC = () => {
    const [stats, setStats] = useState({ totalUsers: 0, totalGamesPlayed: 0 });

    useEffect(() => {
        const unsubscribe = subscribeToGlobalStats(setStats);
        return () => unsubscribe();
    }, []);

    // If no stats yet, render nothing or placeholders
    if (stats.totalGamesPlayed === 0 && stats.totalUsers === 0) {
        return (
            <div className="mt-8 flex flex-col items-center justify-center opacity-0 animate-fade-in transition-opacity duration-1000">
                <div className="flex items-center gap-6 text-sm font-mono tracking-widest text-amber-500/50 bg-black/40 px-6 py-2 rounded-full border border-amber-500/20">
                    <span>CONNECTING...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8 flex flex-col items-center justify-center animate-fade-in-up">
            <style>{`
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
            `}</style>
            <div className="flex items-center gap-6 text-sm md:text-base font-mono tracking-widest text-amber-400 bg-black/60 px-6 py-3 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] relative overflow-hidden">
                {/* Simulated scanline effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent h-[200%] w-full" style={{ animation: 'scanline 4s linear infinite', backgroundSize: '100% 50%' }}></div>
                
                <div className="flex items-center gap-2 relative z-10">
                    <span className="text-amber-500/70">PLAYERS:</span>
                    <span className="text-white font-bold">{stats.totalUsers.toLocaleString()}</span>
                </div>
                <div className="w-1 h-1 bg-amber-500/50 rounded-full relative z-10"></div>
                <div className="flex items-center gap-2 relative z-10">
                    <span className="text-amber-500/70">GAMES SIMULATED:</span>
                    <span className="text-white font-bold">{stats.totalGamesPlayed.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

export default GlobalStatsTicker;
