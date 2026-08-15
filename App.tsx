
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { produce } from 'immer';
import {
    Player, PlayerAttributes, PlayerInGame, Roster, Team, TeamInGame, GameResult, Screen,
    PlayByPlayLog, QuarterStats, GameScore, TeamSeriesStats, PlayerStats
} from './types';
import { players, POSITIONS, allPlayers } from './constants';
import {
    generateStaticGameStory,
    generateStaticSeriesStory
} from './services/templateGenerator';
import {
    generateAIGameStory,
    generateAISeriesStory,
    isGeminiAvailable,
    checkGeminiAvailability,
    NewspaperStory
} from './services/gemini';

// UTILITY & HELPER COMPONENTS

const SpinnerDark: React.FC = () => <div className="spinner-dark mx-auto"></div>;

const MenuButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }> = ({ children, className, variant = 'primary', ...props }) => {
    // Best practices applied:
    // 1. Clear affordance: Gradients, shadows, and shape make it look clickable.
    // 2. States: Distinct hover, focus, and active states for clear feedback.
    // 3. Spacing: Generous padding for easy clicking.
    // 4. Readability: Readable sentence-case labels (by removing 'uppercase').
    // 5. Feedback: 'Pressed' effect on active state with a subtle downward motion.
    const baseClasses = 'font-bold py-3 px-8 rounded-lg text-lg transition-all duration-200 ease-in-out transform focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900/80 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
        primary: 'bg-gradient-to-b from-amber-500 to-amber-600 text-slate-900 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-1 active:translate-y-0 active:shadow-inner active:from-amber-600 active:to-amber-600 focus:ring-amber-400',
        secondary: 'bg-gradient-to-b from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-900/30 hover:shadow-xl hover:shadow-slate-800/40 hover:-translate-y-1 active:translate-y-0 active:shadow-inner active:from-slate-700 active:to-slate-700 focus:ring-slate-500'
    };

    return (
        <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        className="absolute top-6 left-6 bg-gray-800/60 hover:bg-gray-700/80 active:bg-gray-600/90 rounded-full w-10 h-10 flex items-center justify-center text-2xl transition z-20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:ring-offset-2 focus:ring-offset-slate-900"
        aria-label="Go back"
    >
        &larr;
    </button>
);

// GAME LOGIC & UTILITIES

const createPlayerInGame = (playerKey: string): PlayerInGame => {
    const player = allPlayers[playerKey];
    return {
        ...player,
        stats: { pts: 0, reb: 0, ast: 0, mins: 0, pf: 0 },
        stamina: 100,
    };
};

const calculateGameMVP = (playersInGame: PlayerInGame[]): PlayerInGame => {
    if (!playersInGame || playersInGame.length === 0) {
        const defaultPlayer = Object.values(allPlayers)[0];
        return { ...defaultPlayer, stats: { pts: 0, reb: 0, ast: 0, mins: 0, pf: 0}, stamina: 0 };
    }
    return playersInGame.reduce((mvp, p) => {
        const score = p.stats.pts * 1.0 + p.stats.reb * 1.2 + p.stats.ast * 1.5 - p.stats.pf * 2.0;
        const mvpScore = mvp.stats.pts * 1.0 + mvp.stats.reb * 1.2 + mvp.stats.ast * 1.5 - mvp.stats.pf * 2.0;
        return score > mvpScore ? p : mvp;
    });
};

const initializeTeamForSeries = (team: Team): Omit<TeamSeriesStats, 'wins' | 'seriesStats'> => {
    return {
        name: team.name,
        logo: team.logo,
        onCourt: [],
        bench: [],
        roster: {
            starters: Object.values(team.roster.starters).filter((pk): pk is string => !!pk).map(pk => allPlayers[pk]),
            bench: Object.values(team.roster.bench).filter((pk): pk is string => !!pk).map(pk => allPlayers[pk])
        }
    };
};
const initializeSeriesStats = (team: Team): { [playerName: string]: Omit<PlayerStats, 'mins'> } => {
    const stats: { [playerName: string]: Omit<PlayerStats, 'mins'> } = {};
    [...Object.values(team.roster.starters), ...Object.values(team.roster.bench)].forEach(pk => {
        if(pk) stats[allPlayers[pk].name] = { pts: 0, reb: 0, ast: 0, pf: 0 };
    });
    return stats;
};

const calculateSeriesMVP = (winner: TeamSeriesStats, gameCount: number) => {
    let mvp: {
        name: string;
        stats: Omit<PlayerStats, 'mins'> & { img_url: string, ppg: number, rpg: number, apg: number };
    } = { name: '', stats: { pts: 0, reb: 0, ast: 0, pf: 0, img_url: '', ppg: 0, rpg: 0, apg: 0 } };

    let maxScore = -1;

    Object.entries(winner.seriesStats).forEach(([playerName, stats]) => {
        const mvpScore = (stats.pts / gameCount) * 1.0 + (stats.reb / gameCount) * 1.2 + (stats.ast / gameCount) * 1.5 - (stats.pf / gameCount) * 2.0;
        if (mvpScore > maxScore) {
            maxScore = mvpScore;
            const playerInfo = Object.values(allPlayers).find(p => p.name === playerName);
            mvp = {
                name: playerName,
                stats: {
                    ...stats,
                    img_url: playerInfo?.img_url || '',
                    ppg: stats.pts / gameCount,
                    rpg: stats.reb / gameCount,
                    apg: stats.ast / gameCount,
                }
            };
        }
    });
    return mvp;
};

// --- HISTORICAL DATA ---
const historicalSeriesData: { name: string; logo: string; description: string; gameDates: string[]; teams: [Team, Team] }[] = [
    {
        name: '1991 NBA Finals',
        logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/1991.svg',
        description: 'Chicago Bulls vs. Los Angeles Lakers',
        gameDates: ['June 2, 1991', 'June 5, 1991', 'June 7, 1991', 'June 9, 1991', 'June 12, 1991'],
        teams: [
            {
                name: '1991 Chicago Bulls',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/bulls.svg',
                roster: {
                    starters: { PG: 'john_paxson', SG: 'michael_jordan', SF: 'scottie_pippen', PF: 'horace_grant', C: 'bill_cartwright' },
                    bench: { PG: 'bj_armstrong', SG: 'craig_hodges', SF: 'bob_hansen', PF: 'scott_williams', C: 'will_perdue', Bench6: 'cliff_levingston', Bench7: 'stacey_king' }
                }
            },
            {
                name: '1991 Los Angeles Lakers',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/lakers.svg',
                roster: {
                    starters: { PG: 'magic_johnson', SG: 'byron_scott', SF: 'james_worthy', PF: 'sam_perkins', C: 'vlade_divac' },
                    bench: { PG: 'larry_drew', SG: 'terry_teagle', SF: 'ac_green', PF: 'irving_thomas', C: 'mychal_thompson', Bench6: 'elden_campbell', Bench7: 'tony_smith' }
                }
            }
        ]
    },
    {
        name: '1992 NBA Finals',
        logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/1992.svg',
        description: 'Chicago Bulls vs. Portland Trail Blazers',
        gameDates: ['June 3, 1992', 'June 5, 1992', 'June 7, 1992', 'June 10, 1992', 'June 12, 1992', 'June 14, 1992'],
        teams: [
            {
                name: '1992 Chicago Bulls',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/bulls.svg',
                roster: {
                    starters: { PG: 'john_paxson', SG: 'michael_jordan', SF: 'scottie_pippen', PF: 'horace_grant', C: 'bill_cartwright' },
                    bench: { PG: 'bj_armstrong', SG: 'craig_hodges', SF: 'bob_hansen', PF: 'scott_williams', C: 'will_perdue', Bench6: 'cliff_levingston', Bench7: 'stacey_king' }
                }
            },
            {
                name: '1992 Portland Trail Blazers',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/trailblazers.svg',
                roster: {
                    starters: { PG: 'terry_porter', SG: 'clyde_drexler', SF: 'jerome_kersey', PF: 'buck_williams', C: 'kevin_duckworth' },
                    bench: { PG: 'ennis_whatley', SG: 'danny_ainge', SF: 'cliff_robinson', PF: 'mark_bryant', C: 'wayne_cooper', Bench6: 'robert_pack', Bench7: 'alaan_abdelnaby' }
                }
            }
        ]
    },
    {
        name: '1993 NBA Finals',
        logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/1993.svg',
        description: 'Chicago Bulls vs. Phoenix Suns',
        gameDates: ['June 9, 1993', 'June 11, 1993', 'June 13, 1993', 'June 16, 1993', 'June 18, 1993', 'June 20, 1993'],
        teams: [
            {
                name: '1993 Chicago Bulls',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/bulls.svg',
                roster: {
                    starters: { PG: 'bj_armstrong', SG: 'michael_jordan', SF: 'scottie_pippen', PF: 'horace_grant', C: 'bill_cartwright' },
                    bench: { PG: 'john_paxson', SG: 'trent_tucker', SF: 'darrell_walker', PF: 'scott_williams', C: 'stacey_king', Bench6: 'will_perdue', Bench7: 'rodney_mccray' }
                }
            },
            {
                name: '1993 Phoenix Suns',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/suns.svg',
                roster: {
                    starters: { PG: 'kevin_johnson', SG: 'dan_majerle', SF: 'richard_dumas', PF: 'charles_barkley', C: 'mark_west' },
                    bench: { PG: 'frank_johnson', SG: 'danny_ainge', SF: 'cedric_ceballos', PF: 'tom_chambers', C: 'oliver_miller', Bench6: 'negele_knight', Bench7: 'tom_tolbert' }
                }
            }
        ]
    },
    {
        name: '1996 NBA Finals',
        logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/1996.svg',
        description: 'Chicago Bulls vs. Seattle SuperSonics',
        gameDates: ['June 5, 1996', 'June 7, 1996', 'June 9, 1996', 'June 12, 1996', 'June 14, 1996', 'June 16, 1996'],
        teams: [
            {
                name: '1996 Chicago Bulls',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/bulls.svg',
                roster: {
                    starters: { PG: 'ron_harper', SG: 'michael_jordan', SF: 'scottie_pippen', PF: 'dennis_rodman', C: 'luc_longley' },
                    bench: { PG: 'steve_kerr', SG: 'jud_buechler', SF: 'toni_kukoc', PF: 'john_paxson', C: 'bill_wennington', Bench6: 'james_edwards', Bench7: 'randy_brown' }
                }
            },
            {
                name: '1996 Seattle SuperSonics',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/sonics.svg',
                roster: {
                    starters: { PG: 'gary_payton', SG: 'hersey_hawkins', SF: 'detlef_schrempf', PF: 'shawn_kemp', C: 'frank_brickowski' },
                    bench: { PG: 'nate_mcmillan', SG: 'vincent_askew', SF: 'david_wingate', PF: 'sam_perkins', C: 'ervin_johnson_c', Bench6: 'eric_snow', Bench7: 'sherell_ford' }
                }
            }
        ]
    },
    {
        name: '1997 NBA Finals',
        logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/1997.svg',
        description: 'Chicago Bulls vs. Utah Jazz',
        gameDates: ['June 1, 1997', 'June 4, 1997', 'June 6, 1997', 'June 8, 1997', 'June 11, 1997', 'June 13, 1997'],
        teams: [
            {
                name: '1997 Chicago Bulls',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/bulls.svg',
                roster: {
                    starters: { PG: 'ron_harper', SG: 'michael_jordan', SF: 'scottie_pippen', PF: 'dennis_rodman', C: 'luc_longley' },
                    bench: { PG: 'steve_kerr', SG: 'jud_buechler', SF: 'toni_kukoc', PF: 'jason_caffey', C: 'bill_wennington', Bench6: 'randy_brown', Bench7: 'robert_parish' }
                }
            },
            {
                name: '1997 Utah Jazz',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/jazz.svg',
                roster: {
                    starters: { PG: 'john_stockton', SG: 'jeff_hornacek', SF: 'bryon_russell', PF: 'karl_malone', C: 'greg_ostertag' },
                    bench: { PG: 'howard_eisley', SG: 'shandon_anderson', SF: 'stephen_howard', PF: 'adam_keefe', C: 'greg_foster', Bench6: 'antoine_carr', Bench7: 'chris_morris' }
                }
            }
        ]
    },
    {
        name: '1998 NBA Finals',
        logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/1998.svg',
        description: 'Chicago Bulls vs. Utah Jazz',
        gameDates: ['June 3, 1998', 'June 5, 1998', 'June 7, 1998', 'June 10, 1998', 'June 12, 1998', 'June 14, 1998'],
        teams: [
            {
                name: '1998 Chicago Bulls',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/bulls.svg',
                roster: {
                    starters: { PG: 'ron_harper', SG: 'michael_jordan', SF: 'scottie_pippen', PF: 'dennis_rodman', C: 'luc_longley' },
                    bench: { PG: 'steve_kerr', SG: 'jud_buechler', SF: 'toni_kukoc', PF: 'dick_simpkins', C: 'bill_wennington', Bench6: 'randy_brown', Bench7: 'scott_burrell' }
                }
            },
            {
                name: '1998 Utah Jazz',
                logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/jazz.svg',
                roster: {
                    starters: { PG: 'john_stockton', SG: 'jeff_hornacek', SF: 'bryon_russell', PF: 'karl_malone', C: 'greg_foster' },
                    bench: { PG: 'howard_eisley', SG: 'shandon_anderson', SF: 'chris_morris', PF: 'adam_keefe', C: 'greg_ostertag', Bench6: 'antoine_carr', Bench7: 'jacque_vaughn' }
                }
            }
        ]
    },
];


// --- VIEW / SCREEN COMPONENTS ---

const HomeScreen: React.FC<{ onSelectMode: (mode: 'single' | 'series' | 'historical') => void }> = ({ onSelectMode }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 animate-fade-in-up">
        <img src="https://raw.githubusercontent.com/niwde787/basketball-legends/main/logo.png" alt="Basketball Legends Logo" className="w-48 sm:w-56 md:w-72 mx-auto animate-logo" />
        <h1 className="font-headline text-3xl sm:text-4xl md:text-6xl font-black text-amber-400 mt-4 uppercase tracking-wider" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Basketball Legends
        </h1>
        <p className="text-base md:text-lg text-gray-300 mt-2 max-w-2xl">
            Where legends are forged and history is rewritten. Assemble your all-time team and simulate epic matchups to decide who is the greatest of all time.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-6">
            <MenuButton onClick={() => onSelectMode('single')}>Single Game</MenuButton>
            <MenuButton onClick={() => onSelectMode('series')}>Best of 7</MenuButton>
            <MenuButton onClick={() => onSelectMode('historical')}>Historical</MenuButton>
        </div>
    </div>
);

const App: React.FC = () => {
    const [screen, setScreen] = useState<Screen>(Screen.Home);
    const [team1Data, setTeam1Data] = useState<Team | null>(null);
    const [teams, setTeams] = useState<[Team, Team] | null>(null);
    const [isSeries, setIsSeries] = useState(false);
    const [gameResult, setGameResult] = useState<GameResult | null>(null);
    const [historicalSeriesInfo, setHistoricalSeriesInfo] = useState<{name: string, gameDates: string[]}|null>(null);
    const [, setGeminiReady] = useState(false);

    useEffect(() => {
        checkGeminiAvailability().then(() => setGeminiReady(true));
    }, []);

    const handleSelectMode = useCallback((mode: 'single' | 'series' | 'historical') => {
        if (mode === 'historical') {
            setScreen(Screen.HistoricalSeriesSelection);
        } else {
            setIsSeries(mode === 'series');
            setHistoricalSeriesInfo(null);
            setScreen(Screen.RosterSetupTeam1);
        }
    }, []);

    const handleTeam1SetupComplete = (team: Team) => {
        setTeam1Data(team);
        setScreen(Screen.RosterSetupTeam2);
    };

    const handleTeam2SetupComplete = (team2: Team) => {
        if (!team1Data) return;
        setTeams([team1Data, team2]);
        setScreen(isSeries ? Screen.Series : Screen.SingleGame);
    };

    const handleHistoricalSeriesSelect = useCallback((series: (typeof historicalSeriesData)[0]) => {
        setTeams(series.teams);
        setIsSeries(true);
        setHistoricalSeriesInfo({name: series.name, gameDates: series.gameDates});
        setScreen(Screen.Series);
    }, []);
    
    const handleGameEnd = useCallback((result: GameResult) => {
        setGameResult(result);
        setScreen(Screen.PostGame);
    }, []);
    
    const handleReset = useCallback(() => {
        setScreen(Screen.Home);
        setTeams(null);
        setTeam1Data(null);
        setGameResult(null);
        setHistoricalSeriesInfo(null);
    }, []);
    
    const handleBackToHome = useCallback(() => {
        setScreen(Screen.Home);
        setTeam1Data(null);
        setHistoricalSeriesInfo(null);
    }, []);

    const handleRematch = useCallback(() => {
        setGameResult(null);
        setScreen(isSeries ? Screen.Series : Screen.SingleGame);
    }, [isSeries]);

    const renderScreen = () => {
        const screenContent = () => {
             switch (screen) {
                case Screen.Home:
                    return <HomeScreen onSelectMode={handleSelectMode} />;
                case Screen.HistoricalSeriesSelection:
                    return <HistoricalSeriesSelectionScreen onSelect={handleHistoricalSeriesSelect} onBack={handleBackToHome} />;
                case Screen.RosterSetupTeam1:
                    return <RosterSetupScreen
                        key="team1"
                        teamIndex={0}
                        isSeries={isSeries}
                        onSetupComplete={handleTeam1SetupComplete}
                        onBack={handleBackToHome}
                    />;
                case Screen.RosterSetupTeam2:
                     return <RosterSetupScreen
                        key="team2"
                        teamIndex={1}
                        isSeries={isSeries}
                        onSetupComplete={handleTeam2SetupComplete}
                        onBack={() => setScreen(Screen.RosterSetupTeam1)}
                        otherTeam={team1Data}
                    />;
                case Screen.Series:
                    if (!teams) return null;
                    return <SeriesScreen initialTeams={teams} seriesInfo={historicalSeriesInfo} onBack={() => screen === Screen.Series && historicalSeriesInfo ? setScreen(Screen.HistoricalSeriesSelection) : setScreen(Screen.RosterSetupTeam1) } onHome={handleReset}/>;
                case Screen.SingleGame:
                     if (!teams) return null;
                    return <GamePlayScreen teams={teams} onGameEnd={handleGameEnd} onBack={() => setScreen(Screen.RosterSetupTeam1)} />;
                case Screen.PostGame:
                    if (!gameResult) return null;
                    return <PostGameScreen result={gameResult} onRematch={handleRematch} onHome={handleReset} />;
                default:
                    return <HomeScreen onSelectMode={handleSelectMode} />;
            }
        };
        // Using a key on the container div ensures animations re-run on screen change
        return <div key={screen} className="animate-fade-in w-full h-full">{screenContent()}</div>;
    };

    return (
        <main className="bg-slate-900/60 backdrop-blur-xl w-full relative overflow-y-auto custom-scrollbar p-4 sm:max-w-7xl sm:mx-auto sm:my-4 sm:rounded-2xl sm:border border-slate-700/60 shadow-2xl min-h-dvh sm:min-h-0 sm:h-auto sm:max-h-[95dvh]">
            {renderScreen()}
            <div className="absolute bottom-2 right-4 text-xs text-slate-600 font-mono">
                V1.7
            </div>
        </main>
    );
};

// --- In-file Components to keep the structure simple ---

const HistoricalSeriesSelectionScreen: React.FC<{
    onSelect: (series: (typeof historicalSeriesData)[0]) => void;
    onBack: () => void;
}> = ({ onSelect, onBack }) => {
    return (
        <>
            <BackButton onClick={onBack} />
            <header className="text-center mb-8">
                <h1 className="text-3xl md:text-5xl font-bold text-amber-400 font-headline uppercase">
                    Select Historical Series
                </h1>
                <p className="text-lg mt-2 text-gray-300">Relive classic NBA Finals matchups.</p>
            </header>
            <div className="bg-slate-900/40 p-4 md:p-6 rounded-2xl border border-slate-700/60 shadow-inner max-w-5xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4">
                    {historicalSeriesData.map(series => (
                        <button
                            key={series.name}
                            onClick={() => onSelect(series)}
                            className="bg-slate-800/70 p-2 md:p-4 rounded-xl shadow-lg hover:bg-slate-700/80 hover:-translate-y-1 active:translate-y-0 active:bg-slate-700/90 transition-all duration-200 text-left w-full flex flex-col justify-center items-center border border-slate-700 group aspect-square focus:outline-none focus:ring-2 focus:ring-amber-400/80 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                            <div className="flex-grow flex flex-col items-center justify-center">
                                <div className="flex items-center justify-center mb-1 md:mb-2 h-16 md:h-20">
                                    <img
                                        src={series.logo}
                                        alt={`${series.name} Logo`}
                                        className="h-16 md:h-20 w-auto object-contain"
                                    />
                                </div>
                                <h3 className="font-headline text-sm md:text-lg text-amber-300 text-center">{series.name}</h3>
                            </div>
                            <div className="mt-auto pt-1 md:pt-2 text-center text-xs font-bold uppercase text-slate-500 group-hover:text-amber-400 transition-colors">
                                Select Series
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};

const PlayerSlot: React.FC<{
    player: Player | null;
    pos: string;
    onClick: () => void;
}> = ({ player, pos, onClick }) => {
    const tierClasses: { [key: string]: string } = {
        'GOAT': 'border-amber-400 shadow-lg shadow-amber-400/20',
        'Legend': 'border-purple-500 shadow-lg shadow-purple-500/20',
        'All-Star': 'border-sky-500 shadow-lg shadow-sky-500/20',
        'Role Player': 'border-slate-500 shadow-lg shadow-slate-600/20',
    };
    const baseClass = "relative h-32 w-full rounded-xl flex flex-col items-center justify-center p-2 transition-all duration-300 ease-in-out border-2 cursor-pointer group overflow-hidden bg-black/20";

    const slotClasses = player
        ? `${baseClass} ${tierClasses[player.tier] || 'border-slate-600'} bg-slate-900/80 hover:border-amber-400`
        : `${baseClass} border-dashed border-slate-700 bg-slate-800/50 hover:border-amber-400 hover:bg-slate-700/50`;

    return (
        <div className="flex flex-col items-center gap-1">
            <button className={slotClasses} onClick={onClick}>
                {player ? (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10"></div>
                        <img src={player.img_url} alt={player.name} className="absolute inset-0 w-full h-full object-cover object-top opacity-30 group-hover:opacity-40 transition-opacity duration-300" />
                        <div className="relative z-20 flex flex-col items-center justify-end text-center h-full w-full pb-2">
                            <img src={player.img_url} alt={player.name} className="w-14 h-14 rounded-full mb-2 object-cover object-top border-2 border-slate-500" />
                            <span className="font-bold text-white text-sm leading-tight px-1">{player.name}</span>
                        </div>
                        <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-20">{pos}</div>
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                           <span className="text-amber-400 font-bold">CHANGE</span>
                        </div>
                    </>
                ) : (
                     <>
                        <div className="text-4xl text-slate-600 group-hover:text-amber-400 transition-colors font-thin">+</div>
                        <span className="text-sm text-slate-500 mt-1 font-bold">{pos}</span>
                    </>
                )}
            </button>
        </div>
    );
};


const RosterSetupScreen: React.FC<{
    teamIndex: number;
    isSeries: boolean;
    onSetupComplete: (team: Team) => void;
    onBack: () => void;
    otherTeam?: Team | null;
}> = ({ teamIndex, isSeries, onSetupComplete, onBack, otherTeam = null }) => {
    const initialRoster: Roster = { starters: {}, bench: {} };
    const benchPositions = ["Bench1", "Bench2", "Bench3", "Bench4", "Bench5"];
    POSITIONS.forEach(pos => initialRoster.starters[pos] = null);
    benchPositions.forEach(pos => initialRoster.bench[pos] = null);


    const initialTeamData = useMemo(() => ([
        { name: 'Legends United', logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/team1.png', roster: JSON.parse(JSON.stringify(initialRoster)) },
        { name: 'All-Star Squad', logo: 'https://raw.githubusercontent.com/niwde787/basketball-legends/main/team2.png', roster: JSON.parse(JSON.stringify(initialRoster)) }
    ]), []);

    const [team, setTeam] = useState<Team>(initialTeamData[teamIndex]);
    
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [modalOpen, setModalOpen] = useState(false);
    const [activeSlot, setActiveSlot] = useState<{ type: 'starters' | 'bench'; pos: string } | null>(null);

    const playersOnOtherTeam = useMemo(() => {
        const playerSet = new Set<string>();
        if (otherTeam) {
            Object.values(otherTeam.roster.starters).forEach(p => p && playerSet.add(p));
            Object.values(otherTeam.roster.bench).forEach(p => p && playerSet.add(p));
        }
        return playerSet;
    }, [otherTeam]);

    const handlePlayerSelect = (playerKey: string) => {
        if (!activeSlot) return;
        
        const { type, pos } = activeSlot;
        const oldPlayerKey = team.roster[type][pos];

        setTeam(produce(draft => {
            draft.roster[type][pos] = playerKey;
        }));
        
        setSelectedPlayers(prev => {
            const next = new Set(prev);
            if (oldPlayerKey) next.delete(oldPlayerKey);
            next.add(playerKey);
            return next;
        });

        setModalOpen(false);
    };

    const randomizeTeam = () => {
        const availablePlayersByPos: { [pos: string]: string[] } = {};
        POSITIONS.forEach(p => availablePlayersByPos[p] = []);
        Object.entries(players).forEach(([key, player]) => {
            if (!playersOnOtherTeam.has(key)) {
                if (availablePlayersByPos[player.pos]) {
                    availablePlayersByPos[player.pos].push(key);
                }
            }
        });
        
        const allAvailablePlayers = Object.values(availablePlayersByPos).flat();

        const newSelectedPlayers = new Set<string>();
        
        const newTeam = produce(initialTeamData[teamIndex], draft => {
             POSITIONS.forEach(pos => {
                 if (availablePlayersByPos[pos].length > 0) {
                    const randomIndex = Math.floor(Math.random() * availablePlayersByPos[pos].length);
                    const playerKey = availablePlayersByPos[pos].splice(randomIndex, 1)[0];
                    draft.roster.starters[pos] = playerKey;
                    newSelectedPlayers.add(playerKey);
                    const allIndex = allAvailablePlayers.indexOf(playerKey);
                    if(allIndex > -1) allAvailablePlayers.splice(allIndex, 1);
                }
            });
             benchPositions.forEach(pos => {
                 if(allAvailablePlayers.length > 0) {
                     const randomIndex = Math.floor(Math.random() * allAvailablePlayers.length);
                     const playerKey = allAvailablePlayers.splice(randomIndex, 1)[0];
                     draft.roster.bench[pos] = playerKey;
                     newSelectedPlayers.add(playerKey);
                 }
            });
        });

        setTeam(newTeam);
        setSelectedPlayers(newSelectedPlayers);
    };
    
    const allSlotsFilled = useMemo(() => {
        const starterCount = Object.values(team.roster.starters).filter(Boolean).length;
        const benchCount = Object.values(team.roster.bench).filter(Boolean).length;
        return starterCount === 5 && benchCount === 5;
    }, [team.roster]);

    return (
        <>
            <BackButton onClick={onBack} />
            <header className="text-center mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-amber-400 font-headline uppercase">
                    {isSeries ? 'Build Your Series Team' : 'Build Your Game Team'}
                </h1>
                <h2 className="text-2xl mt-1 text-slate-300">Team {teamIndex + 1}</h2>
            </header>
            <div className="bg-slate-800/50 p-4 md:p-6 rounded-xl shadow-lg space-y-6 border border-slate-700">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 flex-grow">
                        <img src={team.logo} alt={`${team.name} logo`} className="w-16 h-16"/>
                        <h2 className="text-2xl font-bold text-amber-300">{team.name}</h2>
                    </div>
                    <MenuButton onClick={randomizeTeam} className="text-sm py-2 px-4 flex-shrink-0">Randomize</MenuButton>
                </div>
                {(['starters', 'bench'] as const).map(type => (
                    <div key={type}>
                        <h4 className="text-lg font-semibold mb-3 border-b-2 border-slate-700 pb-2 capitalize font-headline tracking-wider text-amber-400">{type}</h4>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                            {(type === 'starters' ? POSITIONS : benchPositions).map(pos => {
                                const playerKey = team.roster[type][pos];
                                const player = playerKey ? allPlayers[playerKey] : null;
                                return (
                                    <PlayerSlot
                                        key={pos}
                                        player={player}
                                        pos={type === 'starters' ? pos : 'BN'}
                                        onClick={() => { setActiveSlot({ type, pos }); setModalOpen(true); }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
             <div className="text-center mt-6">
                <MenuButton onClick={() => onSetupComplete(team)} disabled={!allSlotsFilled} title={!allSlotsFilled ? 'Please fill all 10 roster spots' : ''}>
                    {teamIndex === 0 ? "Next" : (isSeries ? "Start Series" : "Start Game")}
                </MenuButton>
            </div>
            {modalOpen && activeSlot && <PlayerModal onClose={() => setModalOpen(false)} onSelect={handlePlayerSelect} positionFilter={activeSlot.type === 'starters' ? activeSlot.pos : 'Any'} selectedPlayers={new Set([...selectedPlayers, ...playersOnOtherTeam])}/>}
        </>
    );
};

const PlayerModal: React.FC<{ onClose: () => void; onSelect: (playerKey: string) => void; positionFilter: string; selectedPlayers: Set<string>; }> = ({ onClose, onSelect, positionFilter, selectedPlayers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tierFilter, setTierFilter] = useState('All');

    const filteredPlayers = useMemo(() => {
        return Object.entries(players).filter(([key, p]) => {
            const posMatch = positionFilter === 'Any' || p.pos === positionFilter;
            const nameMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const tierMatch = tierFilter === 'All' || p.tier === tierFilter;
            return posMatch && nameMatch && tierMatch;
        }).sort(([, a], [, b]) => {
            const tierOrder = ['GOAT', 'Legend', 'All-Star', 'Role Player'];
            const tierDiff = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
            if (tierDiff !== 0) return tierDiff;
            return b.attributes.inside_scoring + b.attributes.playmaking - (a.attributes.inside_scoring + a.attributes.playmaking);
        });
    }, [positionFilter, searchTerm, tierFilter]);

    const tierTextClasses: { [key: string]: string } = {
        'GOAT': 'text-amber-400',
        'Legend': 'text-purple-400',
        'All-Star': 'text-sky-400',
        'Role Player': 'text-slate-400',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900/95 backdrop-blur-lg rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col border border-slate-700">
                <div className="p-4 border-b border-slate-700/80 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold font-headline text-amber-400 whitespace-nowrap pr-4">Select a Player {positionFilter !== 'Any' && `for ${positionFilter}`}</h3>
                        <div className="flex flex-wrap gap-1 sm:gap-2 justify-end">
                            {(['All', 'GOAT', 'Legend', 'All-Star', 'Role Player'] as const).map(tier => (
                                <button key={tier} onClick={() => setTierFilter(tier)} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 border-2 active:scale-95 ${tierFilter === tier ? 'bg-amber-500 border-amber-400 text-slate-900' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/80'}`}>
                                    {tier}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-3">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 bg-slate-800 rounded-md border border-slate-600 focus:ring-amber-500 focus:border-amber-500" placeholder="Search by name..."/>
                    </div>
                </div>
                <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
                     {filteredPlayers.map(([key, p]) => {
                        const isSelected = selectedPlayers.has(key);
                        return (
                            <button
                                key={key}
                                onClick={() => onSelect(key)}
                                disabled={isSelected}
                                className={`relative w-full p-3 text-left transition-colors duration-200 rounded-lg ${isSelected ? 'cursor-not-allowed' : 'hover:bg-slate-800/60 focus-visible:outline-none focus-visible:bg-slate-800/60 active:bg-slate-700/70'}`}
                            >
                                <div className={`flex items-center justify-between ${isSelected ? 'opacity-40' : ''}`}>
                                    <div className="flex items-center gap-4 min-w-0">
                                        <img src={p.img_url} alt={p.name} className="w-14 h-14 rounded-full object-cover object-center border-2 border-slate-600 shadow-md flex-shrink-0" />
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-lg text-white leading-tight truncate">{p.name}</h4>
                                            <p className="text-xs text-slate-400 mt-1 font-mono">
                                                PPG: {p.career_stats.ppg.toFixed(1)} | RPG: {p.career_stats.rpg.toFixed(1)} | APG: {p.career_stats.apg.toFixed(1)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-semibold whitespace-nowrap px-2 ml-4 ${tierTextClasses[p.tier]}`}>
                                        {p.tier}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <span className="font-bold text-slate-500 text-lg tracking-widest bg-slate-900/60 px-4 py-1 rounded">SELECTED</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="p-4 border-t border-slate-700/80 flex-shrink-0">
                    <MenuButton onClick={onClose} variant="secondary" className="w-full">Cancel</MenuButton>
                </div>
            </div>
        </div>
    );
};

const getPeriodName = (quarter: number): string => {
    if (quarter <= 4) return `Q${quarter}`;
    return `OT${quarter - 4}`;
};

const GamePlayScreen: React.FC<{ teams: [Team, Team], onGameEnd: (result: GameResult) => void, onBack: () => void, gameNumber?: number }> = ({ teams, onGameEnd, onBack, gameNumber = 1 }) => {
    
    const initializeTeams = useCallback((): [TeamInGame, TeamInGame] => {
        return teams.map(team => ({
            name: team.name,
            logo: team.logo,
            onCourt: Object.values(team.roster.starters).filter((pk): pk is string => !!pk).map(pk => createPlayerInGame(pk)),
            bench: Object.values(team.roster.bench).filter((pk): pk is string => !!pk).map(pk => createPlayerInGame(pk)),
            roster: {
                starters: Object.values(team.roster.starters).filter((pk): pk is string => !!pk).map(pk => allPlayers[pk]),
                bench: Object.values(team.roster.bench).filter((pk): pk is string => !!pk).map(pk => allPlayers[pk])
            }
        })) as [TeamInGame, TeamInGame];
    }, [teams]);
    
    const [gameTeams, setGameTeams] = useState<[TeamInGame, TeamInGame]>(initializeTeams);
    const [score, setScore] = useState<GameScore>({ q1: {t1:0, t2:0}, q2: {t1:0, t2:0}, q3: {t1:0, t2:0}, q4: {t1:0, t2:0} });
    const [currentQuarter, setCurrentQuarter] = useState(1);
    const [playByPlay, setPlayByPlay] = useState<PlayByPlayLog[]>([]);
    const [lastLeadTeam, setLastLeadTeam] = useState(0);
    const [isSimulating, setIsSimulating] = useState(false);
    const [isSimulatingFullGame, setIsSimulatingFullGame] = useState(false);
    const [buzzerPlayed, setBuzzerPlayed] = useState(false);

    const runQuarterSimulation = useCallback(() => {
        setIsSimulating(true);

        setTimeout(() => {
            const isOvertime = currentQuarter > 4;
            const possessions = isOvertime ? 20 : 48; // 5-min OT vs 12-min quarter
            const minutesPerPeriod = isOvertime ? 5 : 12;

            const quarterStats: QuarterStats = { plays: [], playerPoints: {}, leadChanges: 0 };
            let localLastLeadTeam = lastLeadTeam;
            const qScore = { t1: 0, t2: 0 };
            const t1TotalBefore = Object.values(score).reduce((s, q) => s + q.t1, 0);
            const t2TotalBefore = Object.values(score).reduce((s, q) => s + q.t2, 0);

            const teamsAfterQuarter = produce(gameTeams, draft => {
                for (let i = 0; i < possessions; i++) {
                    const offenseIndex = i % 2;
                    const offense = draft[offenseIndex];
                    const defense = draft[(offenseIndex + 1) % 2];
                    const totalUsage = offense.onCourt.reduce((sum, p) => sum + p.career_stats.usg_pct, 0);
                    let randomUsage = Math.random() * totalUsage;
                    let offensivePlayer = offense.onCourt[0];
                    for (const player of offense.onCourt) {
                        randomUsage -= player.career_stats.usg_pct;
                        if (randomUsage <= 0) { offensivePlayer = player; break; }
                    }
                    
                    let passChance = 40.0;
                    passChance += (offensivePlayer.attributes.playmaking - 80) * 1.5;
                    passChance -= (offensivePlayer.career_stats.usg_pct - 25) * 2.0;
                    if (offensivePlayer.traits.includes("Floor General")) passChance += 20;
                    if (offensivePlayer.traits.includes("Alpha Dog")) passChance -= 25;
                    if (offensivePlayer.traits.includes("Unstoppable Scorer")) passChance -= 20;
                    passChance = Math.max(5, Math.min(95, passChance));
                    
                    let shooter: PlayerInGame;
                    let assister: PlayerInGame | null = null;

                    if (Math.random() * 100 < passChance && offense.onCourt.length > 1) {
                        const potentialShooters = offense.onCourt.filter(p => p.name !== offensivePlayer.name);
                        shooter = potentialShooters[Math.floor(Math.random() * potentialShooters.length)];
                        assister = offensivePlayer;
                    } else {
                        shooter = offensivePlayer;
                    }

                    offensivePlayer.stamina -= 2;
                    
                    const shotDefender = defense.onCourt.find(p => p.pos === shooter.pos) || defense.onCourt[Math.floor(Math.random() * 5)];
                    shotDefender.stamina -= 1;

                    const { shot_tendencies } = shooter;
                    const totalShotWeight = shot_tendencies.inside + shot_tendencies.mid + shot_tendencies.three;
                    let randomShot = Math.random() * totalShotWeight;
                    let shotType: keyof Pick<PlayerAttributes, 'inside_scoring' | 'mid_range' | 'three_point'>;
                    if (randomShot < shot_tendencies.inside) shotType = 'inside_scoring';
                    else if (randomShot < shot_tendencies.inside + shot_tendencies.mid) shotType = 'mid_range';
                    else shotType = 'three_point';
                    
                    const offRating = shooter.attributes[shotType] * (shooter.stamina / 100);
                    const defRating = (shotType === 'inside_scoring' ? shotDefender.attributes.interior_defense : shotDefender.attributes.perimeter_defense) * (shotDefender.stamina / 100);
                    
                    let scoreChance = shooter.career_stats.fg_pct + (offRating - defRating) * 0.75;

                    if (assister && assister.traits.includes("Floor General")) scoreChance += 3;
                    if (shooter.traits.includes("Unstoppable Scorer")) scoreChance += 3;
                    if (shooter.traits.includes("Clutch Performer") && currentQuarter >= 4) scoreChance += 5;
                    if (shotType === 'inside_scoring' && shotDefender.traits.includes("Rim Protector")) scoreChance -= 7;
                    if (shotType !== 'inside_scoring' && shotDefender.traits.includes("Lockdown Defender")) scoreChance -= 7;
                    
                    if (Math.random() * 100 < shotDefender.foul_tendency * 2) { shotDefender.stats.pf++; }
                    
                    if (Math.random() * 100 < scoreChance) {
                        const points = shotType === 'three_point' ? 3 : 2;
                        shooter.stats.pts += points;
                        if (offenseIndex === 0) qScore.t1 += points; else qScore.t2 += points;
                        if (assister) assister.stats.ast++;
                        quarterStats.playerPoints[shooter.name] = (quarterStats.playerPoints[shooter.name] || 0) + points;
                        const t1CurrentScore = t1TotalBefore + qScore.t1;
                        const t2CurrentScore = t2TotalBefore + qScore.t2;
                        const currentLeadTeam = t1CurrentScore > t2CurrentScore ? 1 : (t2CurrentScore > t1CurrentScore ? 2 : 0);
                        if (currentLeadTeam !== 0 && currentLeadTeam !== localLastLeadTeam) {
                            quarterStats.leadChanges++;
                            localLastLeadTeam = currentLeadTeam;
                        }
                        quarterStats.plays.push(`<span class="text-green-400">SCORE:</span> ${shooter.name} scores ${points} points ${assister ? `(assist by ${assister.name})` : ''}. (${t1CurrentScore}-${t2CurrentScore})`);
                    } else {
                        const allPlayersOnCourt = [...offense.onCourt, ...defense.onCourt];
                        const reboundChances = allPlayersOnCourt.map(p => {
                            let chance = p.attributes.rebounding * (p.stamina / 100);
                            if (['PF', 'C'].includes(p.pos)) chance *= 1.2;
                            if (p.traits.includes('Tireless Motor')) chance *= 1.1;
                            if (p.traits.includes('Post Anchor')) chance *= 1.1;
                            const isDefender = defense.onCourt.some(def => def.name === p.name);
                            if (isDefender) chance *= 1.5;
                            return { player: p, chance };
                        });
                        const totalRebChance = reboundChances.reduce((sum, item) => sum + item.chance, 0);
                        let randomReb = Math.random() * totalRebChance;
                        let rebounder = reboundChances[reboundChances.length - 1].player;
                        for (const item of reboundChances) {
                            randomReb -= item.chance;
                            if (randomReb <= 0) {
                                rebounder = item.player;
                                break;
                            }
                        }
                        rebounder.stats.reb++;
                        quarterStats.plays.push(`<span class="text-yellow-400">MISS:</span> ${shooter.name}'s shot is off. Rebound by ${rebounder.name}.`);
                    }
                }
                draft.forEach(t => t.onCourt.forEach(p => p.stats.mins += minutesPerPeriod));
            });

            const teamsAfterSubs = produce(teamsAfterQuarter, draft => {
                // This "Rotation Manager" logic runs at the end of quarters 1, 2, and 3.
                if (currentQuarter > 3) {
                    // In Q4 and OT, just recover stamina for bench players.
                    draft.forEach(team => {
                        team.bench.forEach(p => p.stamina = Math.min(100, p.stamina + 25));
                    });
                    return;
                }

                draft.forEach((team, teamIndex) => {
                    // 1. Recover stamina for all players currently on the bench BEFORE making decisions
                    team.bench.forEach(p => p.stamina = Math.min(100, p.stamina + 25));

                    // 2. Pool all players for evaluation
                    const allPlayersOnTeam = [...team.onCourt, ...team.bench];
                    const newOnCourt: PlayerInGame[] = [];
                    const assignedPlayerIds = new Set<number>();

                    // 3. For each of the 5 court positions, select the best player from the pool
                    POSITIONS.forEach(pos => {
                        const candidates = allPlayersOnTeam.filter(p => p.pos === pos);

                        if (candidates.length > 0) {
                            let bestPlayer: PlayerInGame | null = null;
                            let maxScore = -Infinity;

                            candidates.forEach(player => {
                                let score = 0;
                                const minuteDiff = player.target_minutes - player.stats.mins;
                                score += minuteDiff * 2.5;
                                score += player.stamina * 0.4;
                                if (player.stats.pf >= 4) score -= 1000;
                                
                                const originalStarters = teams[teamIndex].roster.starters;
                                const playerKey = Object.keys(allPlayers).find(k => allPlayers[k].id === player.id);
                                if (originalStarters[pos] === playerKey) {
                                    score += 15;
                                }

                                if (score > maxScore) {
                                    maxScore = score;
                                    bestPlayer = player;
                                }
                            });
                            
                            if (bestPlayer && !assignedPlayerIds.has(bestPlayer.id)) {
                                newOnCourt.push(bestPlayer);
                                assignedPlayerIds.add(bestPlayer.id);
                            }
                        }
                    });

                    if (newOnCourt.length === 5) {
                        team.onCourt = newOnCourt;
                        team.bench = allPlayersOnTeam.filter(p => !assignedPlayerIds.has(p.id));
                    } else {
                         console.error("Malformed roster for team:", team.name, ". Could not form a full 5-man lineup. Aborting substitution.");
                    }
                });
            });

            setGameTeams(teamsAfterSubs);
            
            const qKey = getPeriodName(currentQuarter).toLowerCase();
            setScore(s => ({ ...s, [qKey]: qScore }));

            let star = { name: 'None', points: 0 };
            Object.entries(quarterStats.playerPoints).forEach(([name, points]) => {
                if (points > star.points) { star = { name, points: points as number }; }
            });
            const quarterLog: PlayByPlayLog = {
                quarter: currentQuarter,
                star: star.name !== 'None' ? `${star.name} (${star.points} pts)` : 'Balanced scoring',
                leadChanges: quarterStats.leadChanges,
                plays: quarterStats.plays,
            };
            setPlayByPlay(p => [quarterLog, ...p]);
            setLastLeadTeam(localLastLeadTeam);
            setCurrentQuarter(q => q + 1);
            setIsSimulating(false);
        }, 500);
    }, [currentQuarter, gameTeams, lastLeadTeam, score, teams]);

    useEffect(() => {
        if (isSimulatingFullGame && !isSimulating) {
            const t1_total = Object.values(score).reduce((s, q) => s + q.t1, 0);
            const t2_total = Object.values(score).reduce((s, q) => s + q.t2, 0);

            if (currentQuarter > 4 && t1_total !== t2_total) {
                setIsSimulatingFullGame(false);
                return;
            }
            
            runQuarterSimulation();
        }
    }, [isSimulatingFullGame, isSimulating, currentQuarter, runQuarterSimulation, score]);


    const handleSimulateFullGame = () => {
        setIsSimulatingFullGame(true);
    };

    const handleFinalize = () => {
        const t1_final_score = Object.values(score).reduce((s, q) => s + q.t1, 0);
        const t2_final_score = Object.values(score).reduce((s, q) => s + q.t2, 0);

        const winner = t1_final_score >= t2_final_score ? gameTeams[0] : gameTeams[1];
        const loser = t1_final_score < t2_final_score ? gameTeams[0] : gameTeams[1];
        
        const winnerPlayers = [...winner.onCourt, ...winner.bench];
        const mvp = calculateGameMVP(winnerPlayers);
        
        const overtimePeriods = Object.keys(score).filter(k => k.startsWith('ot')).length;
        const totalMinutes = (4 * 12) + (overtimePeriods * 5);

        onGameEnd({
            gameNumber,
            winner,
            loser,
            score: `${Math.max(t1_final_score, t2_final_score)} - ${Math.min(t1_final_score, t2_final_score)}`,
            team1: gameTeams[0],
            team2: gameTeams[1],
            halftimeScore: `${score.q1.t1 + score.q2.t1} - ${score.q1.t2 + score.q2.t2}`,
            leadChanges: playByPlay.reduce((acc, q) => acc + q.leadChanges, 0),
            mvp,
            totalMinutes
        });
    };

    const t1_total = Object.values(score).reduce((s, q) => s + q.t1, 0);
    const t2_total = Object.values(score).reduce((s, q) => s + q.t2, 0);

    const scoreHeaders = useMemo(() => {
        const quarters = ['q1', 'q2', 'q3', 'q4'];
        const overtimes = Object.keys(score)
            .filter(k => k.startsWith('ot'))
            .sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
        const relevantQuarters = quarters.filter(q => score[q] && (score[q].t1 > 0 || score[q].t2 > 0));
        return [...relevantQuarters, ...overtimes];
    }, [score]);

    const isGameOver = currentQuarter > 4 && t1_total !== t2_total;
    const gameInProgress = !isGameOver;

    useEffect(() => {
        if (isGameOver && !buzzerPlayed) {
            const buzzer = document.getElementById('buzzer-sound') as HTMLAudioElement;
            if (buzzer) {
                buzzer.play().catch(error => {
                    console.error("Buzzer sound playback failed:", error);
                });
            }
            setBuzzerPlayed(true);
        }
    }, [isGameOver, buzzerPlayed]);

    return (
        <>
        <BackButton onClick={onBack} />
        <header className="text-center mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline uppercase text-amber-400">Game {gameNumber}</h1>
            <p className="text-5xl sm:text-6xl font-black my-1" style={{fontFamily: "'Oswald', sans-serif"}}>{t1_total} - {t2_total}</p>
        </header>
        <div className="bg-slate-900/80 p-4 rounded-xl shadow-lg max-w-2xl mx-auto border border-slate-700 overflow-x-auto custom-scrollbar">
             <table className="w-full text-center min-w-[320px]">
                <thead>
                    <tr className="border-b-2 border-slate-700">
                        <th className="p-2 text-left font-headline tracking-wider">Team</th>
                        {scoreHeaders.map(p => <th key={p} className="p-2 font-headline tracking-wider">{p.toUpperCase()}</th>)}
                        <th className="p-2 font-headline tracking-wider">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-2 text-left font-bold text-sky-400">
                            <div className="flex items-center gap-2">
                                <img src={gameTeams[0].logo} alt={`${gameTeams[0].name} logo`} className="w-8 h-8"/>
                                <span>{gameTeams[0].name}</span>
                            </div>
                        </td>
                        {scoreHeaders.map(p => <td key={p} className="p-2 font-bold tabular-nums">{score[p]?.t1 ?? 0}</td>)}
                        <td className="font-bold p-2 text-xl tabular-nums">{t1_total}</td>
                    </tr>
                    <tr>
                        <td className="p-2 text-left font-bold text-orange-400">
                            <div className="flex items-center gap-2">
                                <img src={gameTeams[1].logo} alt={`${gameTeams[1].name} logo`} className="w-8 h-8"/>
                                <span>{gameTeams[1].name}</span>
                            </div>
                        </td>
                        {scoreHeaders.map(p => <td key={p} className="p-2 font-bold tabular-nums">{score[p]?.t2 ?? 0}</td>)}
                        <td className="font-bold p-2 text-xl tabular-nums">{t2_total}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div className="text-center my-6">
            {gameInProgress ? (
                <div className="flex justify-center items-center gap-4">
                    <MenuButton onClick={runQuarterSimulation} disabled={isSimulating || isSimulatingFullGame}>
                        {isSimulating ? 'Simulating...' : `Simulate ${getPeriodName(currentQuarter)}`}
                    </MenuButton>
                    {currentQuarter <= 4 && (
                        <MenuButton onClick={handleSimulateFullGame} disabled={isSimulating || isSimulatingFullGame} variant="secondary">
                            Sim Game
                        </MenuButton>
                    )}
                </div>
            ) : (
                <MenuButton onClick={handleFinalize}>Finalize Game</MenuButton>
            )}
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg max-w-2xl mx-auto space-y-2">
            <h3 className="text-xl font-bold mb-2 text-center text-amber-400 font-headline tracking-wider">Play-by-Play Recap</h3>
            {playByPlay.length > 0 ? playByPlay.map(q => (
                <div key={q.quarter} className="mb-4">
                    <div className="p-2 bg-slate-700 rounded-t-lg font-bold text-amber-300 flex justify-between text-sm">
                        <span>{getPeriodName(q.quarter)} Summary</span>
                        <span>Star: {q.star}</span>
                        <span>Lead Changes: {q.leadChanges}</span>
                    </div>
                    <ul className="text-sm p-3 bg-slate-900/70 rounded-b-lg space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {q.plays.length > 0 ? 
                            q.plays.slice().reverse().map((play, index) => <li key={index} dangerouslySetInnerHTML={{ __html: play }} />) : 
                            <li>No significant plays in this period.</li>}
                    </ul>
                </div>
            )) : <p className="text-center text-gray-400">Simulate a period to see the action.</p>}
        </div>
        </>
    );
};

const WinTracker: React.FC<{ wins: number, teamColor: string }> = ({ wins, teamColor }) => (
    <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
             <div key={i} className={`w-3 h-3 md:w-4 md:h-4 rounded-full transition-colors duration-500 ${i < wins ? teamColor : 'bg-slate-700'}`}></div>
        ))}
    </div>
);


const SeriesScreen: React.FC<{ 
    initialTeams: [Team, Team],
    seriesInfo: { name: string, gameDates: string[] } | null,
    onBack: () => void, 
    onHome: () => void 
}> = ({ initialTeams, seriesInfo, onBack, onHome }) => {
    const [team1, setTeam1] = useState<TeamSeriesStats>(() => ({ ...initializeTeamForSeries(initialTeams[0]), wins: 0, seriesStats: initializeSeriesStats(initialTeams[0]) }));
    const [team2, setTeam2] = useState<TeamSeriesStats>(() => ({ ...initializeTeamForSeries(initialTeams[1]), wins: 0, seriesStats: initializeSeriesStats(initialTeams[1]) }));
    const [gameResults, setGameResults] = useState<GameResult[]>([]);
    const [simulating, setSimulating] = useState(false);

    const isSeriesOver = team1.wins >= 4 || team2.wins >= 4;
    const gameNumber = team1.wins + team2.wins + 1;
    const isHistorical = !!seriesInfo;

    const handleGameEnd = (result: GameResult) => {
        setGameResults(prev => [...prev, result]);

        const updateStats = (currentTeam: TeamSeriesStats, gameTeam: TeamInGame): { [playerName: string]: Omit<PlayerStats, 'mins'> } => {
            return produce(currentTeam.seriesStats, draft => {
                [...gameTeam.onCourt, ...gameTeam.bench].forEach(p => {
                    if (draft[p.name]) {
                        draft[p.name].pts += p.stats.pts;
                        draft[p.name].reb += p.stats.reb;
                        draft[p.name].ast += p.stats.ast;
                        draft[p.name].pf += p.stats.pf;
                    }
                });
            });
        };

        if (result.winner.name === team1.name) {
            setTeam1(t => ({...t, wins: t.wins + 1, seriesStats: updateStats(t, result.team1)}));
            setTeam2(t => ({...t, seriesStats: updateStats(t, result.team2)}));
        } else {
            setTeam2(t => ({...t, wins: t.wins + 1, seriesStats: updateStats(t, result.team2)}));
            setTeam1(t => ({...t, seriesStats: updateStats(t, result.team1)}));
        }
        setSimulating(false);
    };
    
    const handleRematch = () => {
        setTeam1(() => ({ ...initializeTeamForSeries(initialTeams[0]), wins: 0, seriesStats: initializeSeriesStats(initialTeams[0]) }));
        setTeam2(() => ({ ...initializeTeamForSeries(initialTeams[1]), wins: 0, seriesStats: initializeSeriesStats(initialTeams[1]) }));
        setGameResults([]);
    };
    
    if (simulating) {
        return <GamePlayScreen teams={initialTeams} onGameEnd={handleGameEnd} onBack={() => setSimulating(false)} gameNumber={gameNumber} />;
    }
    
    if (isSeriesOver) {
        const winner = team1.wins > team2.wins ? team1 : team2;
        const loser = team1.wins > team2.wins ? team2 : team1;
        
        return <SeriesEndScreen 
            winner={winner} 
            loser={loser} 
            gameResults={gameResults} 
            onRematch={handleRematch} 
            onHome={onHome}
            isHistorical={isHistorical}
        />;
    }

    return (
        <>
            <BackButton onClick={onBack} />
            <header className="text-center mb-6">
                <h1 className="text-3xl font-bold font-headline uppercase text-amber-400">{seriesInfo ? seriesInfo.name : 'Best-of-7 Series'}</h1>
                <div className="flex flex-col sm:flex-row justify-around items-center my-4 gap-4 sm:gap-0">
                    <div className="flex flex-col items-center gap-2 text-center w-1/3">
                        <img src={team1.logo} alt={`${team1.name} logo`} className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"/>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-sky-400">{team1.name}</p>
                        <WinTracker wins={team1.wins} teamColor="bg-sky-400" />
                    </div>
                    <p className="text-4xl sm:text-5xl md:text-7xl font-black" style={{fontFamily: "'Oswald', sans-serif"}}><span className="text-sky-400">{team1.wins}</span> - <span className="text-orange-400">{team2.wins}</span></p>
                    <div className="flex flex-col items-center gap-2 text-center w-1/3">
                        <img src={team2.logo} alt={`${team2.name} logo`} className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"/>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-orange-400">{team2.name}</p>
                        <WinTracker wins={team2.wins} teamColor="bg-orange-400" />
                    </div>
                </div>
            </header>
            <div className="text-center mb-6">
                <MenuButton onClick={() => setSimulating(true)}>Simulate Game {gameNumber}</MenuButton>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl shadow-lg min-h-[200px] max-w-4xl mx-auto">
                <h3 className="text-xl font-bold mb-4 font-headline tracking-wider text-amber-400">Series Log</h3>
                <ul className="text-gray-300 space-y-4">{gameResults.length > 0 ? gameResults.map((result, index) => <SeriesLogItem key={index} result={result} date={seriesInfo?.gameDates[index]} />) : <p className="text-center text-slate-400 py-8">No games played yet. Click above to start the series!</p>}</ul>
            </div>
        </>
    );
};

const SeriesLogItem: React.FC<{result: GameResult, date?: string}> = ({result, date}) => (
    <li className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/70 transition-all hover:bg-slate-800/50 hover:border-slate-600">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col text-center md:text-left">
                <p className="font-bold text-lg"><span className="text-slate-400">Game {result.gameNumber}:</span> {result.winner.name} def. {result.loser.name}</p>
                 <p className="font-headline text-3xl font-black text-amber-400 my-1">{result.score}</p>
                 {date && <p className="text-xs text-gray-500">{date}</p>}
            </div>
            <div className="text-sm text-gray-300 mt-2 md:mt-0 flex flex-col items-center gap-2 bg-black/20 p-3 rounded-lg min-w-[200px]">
                <p className="font-bold text-amber-400 text-xs uppercase tracking-widest">Game MVP</p>
                <img src={result.mvp.img_url} alt={result.mvp.name} className="w-12 h-12 rounded-full object-cover object-center border-2 border-slate-500"/>
                <span className="font-bold">{result.mvp.name}</span>
                <span className="text-xs text-slate-400">{result.mvp.stats.pts} PTS, {result.mvp.stats.reb} REB, {result.mvp.stats.ast} AST</span>
            </div>
        </div>
    </li>
)

const BoxScore: React.FC<{ team: TeamInGame, totalMinutes: number }> = ({ team, totalMinutes }) => {
    const allPlayersWithStats = [...team.onCourt, ...team.bench].reduce((acc, p) => {
        acc[p.name] = p;
        return acc;
    }, {} as { [name: string]: PlayerInGame });

    const starters = team.roster.starters.map(p => allPlayersWithStats[p.name]).filter(Boolean);
    const bench = team.roster.bench.map(p => allPlayersWithStats[p.name]).filter(Boolean);

    const totals = [...starters, ...bench].reduce((acc, p) => {
        if (!p) return acc;
        acc.pts += p.stats.pts;
        acc.reb += p.stats.reb;
        acc.ast += p.stats.ast;
        acc.pf += p.stats.pf;
        return acc;
    }, { pts: 0, reb: 0, ast: 0, pf: 0 });

    const PlayerRow: React.FC<{ player: PlayerInGame }> = ({ player }) => (
        <tr>
            <td className="py-1 px-2 font-semibold whitespace-nowrap">{player.name.split(' ').slice(-1)[0]}</td>
            <td className="py-1 px-2 text-center">{player.stats.mins}</td>
            <td className="py-1 px-2 text-center">{player.stats.pts}</td>
            <td className="py-1 px-2 text-center">{player.stats.reb}</td>
            <td className="py-1 px-2 text-center">{player.stats.ast}</td>
            <td className="py-1 px-2 text-center">{player.stats.pf}</td>
        </tr>
    );

    return (
        <div className="border border-black p-2 bg-white/60">
            <div className="flex items-center justify-center gap-2 mb-2">
                <img src={team.logo} alt={`${team.name} logo`} className="w-10 h-10" />
                <h4 className="text-lg font-headline text-gray-900 uppercase tracking-wider">{team.name} ({totals.pts})</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-newspaper text-gray-800">
                    <thead>
                        <tr className="border-y-2 border-black bg-gray-300/50">
                            <th className="py-1 px-2 font-bold">PLAYER</th>
                            <th className="py-1 px-2 text-center font-bold">MIN</th>
                            <th className="py-1 px-2 text-center font-bold">PTS</th>
                            <th className="py-1 px-2 text-center font-bold">REB</th>
                            <th className="py-1 px-2 text-center font-bold">AST</th>
                            <th className="py-1 px-2 text-center font-bold">PF</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-400/50">
                        {starters.sort((a,b) => (POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos))).map(p => p && <PlayerRow key={p.name} player={p} />)}
                        {bench.length > 0 && (
                            <tr className="bg-gray-300/40 font-bold"><td colSpan={6} className="py-1 px-2 text-gray-600">BENCH</td></tr>
                        )}
                        {bench.sort((a,b) => b.stats.mins - a.stats.mins).map(p => p && <PlayerRow key={p.name} player={p} />)}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black bg-gray-300/50 font-bold">
                            <td className="py-1 px-2">TOTALS</td>
                            <td className="py-1 px-2 text-center">{totalMinutes}</td>
                            <td className="py-1 px-2 text-center">{totals.pts}</td>
                            <td className="py-1 px-2 text-center">{totals.reb}</td>
                            <td className="py-1 px-2 text-center">{totals.ast}</td>
                            <td className="py-1 px-2 text-center">{totals.pf}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

const MVPFeature: React.FC<{ name: string; imgSrc: string; stats: string; title: string }> = ({ name, imgSrc, stats, title }) => (
    <figure className="my-6 p-4 border border-black/20 bg-black/5">
        <h3 className="font-headline text-2xl text-center border-b-2 border-black pb-2 mb-4">{title}</h3>
        <div className="flex flex-col items-center text-center">
             <div className="bg-white p-1 shadow-md inline-block">
                <img
                    src={imgSrc}
                    alt={name}
                    className="w-full max-w-xs object-cover"
                    style={{ aspectRatio: '3/4', objectPosition: 'top' }}
                />
            </div>
            <figcaption className="mt-2">
                <p className="text-2xl font-bold font-headline">{name}</p>
                <p className="text-gray-700 text-sm font-semibold">{stats}</p>
            </figcaption>
        </div>
    </figure>
);


const PostGameScreen: React.FC<{ 
    result: GameResult, 
    onRematch:()=>void, 
    onHome:()=>void,
    onContinueSeries?: () => void 
}> = ({ result, onRematch, onHome, onContinueSeries }) => {
    
    const [story, setStory] = useState<NewspaperStory>(() => ({
        ...generateStaticGameStory(result),
        isAIGenerated: false
    }));
    const [isLoadingAI, setIsLoadingAI] = useState(false);

    const loadStory = useCallback(async () => {
        if (isGeminiAvailable()) {
            setIsLoadingAI(true);
            try {
                const aiStory = await generateAIGameStory(result);
                setStory(aiStory);
            } catch (e) {
                console.error('Failed to generate AI story:', e);
            } finally {
                setIsLoadingAI(false);
            }
        }
    }, [result]);

    useEffect(() => {
        loadStory();
    }, [loadStory]);
    
    return (
        <>
            <BackButton onClick={onContinueSeries || onHome} />
            <div className="newspaper-bg text-black p-4 sm:p-6 md:p-10 rounded-lg shadow-2xl my-8">
                <article>
                    <header className="text-center border-b-4 border-black pb-4 mb-4">
                        <img src="https://raw.githubusercontent.com/niwde787/basketball-legends/main/newspapper.png" alt="The Virtual Chronicle" className="mx-auto h-16 md:h-20 mb-4" />
                        <div className="flex justify-center items-center gap-2 mb-2">
                            {isLoadingAI && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-full animate-pulse border border-amber-400">
                                    ✍️ Generating AI Chronicle...
                                </span>
                            )}
                            {!isLoadingAI && story.isAIGenerated && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                                    ✨ AI Chronicle (Gemini)
                                </span>
                            )}
                            {!isLoadingAI && isGeminiAvailable() && (
                                <button
                                    onClick={loadStory}
                                    title="Regenerate with Gemini AI"
                                    className="text-xs font-semibold px-2.5 py-0.5 bg-black/10 hover:bg-black/20 text-gray-800 rounded-full transition-colors border border-black/20"
                                >
                                    🔄 Regenerate
                                </button>
                            )}
                        </div>
                        <h1 className="font-headline text-2xl sm:text-4xl md:text-5xl my-2 text-gray-900">{story.headline}</h1>
                        <h2 className="font-newspaper text-lg sm:text-xl md:text-2xl text-gray-800">{story.subheadline}</h2>
                        <p className="text-sm italic mt-4 text-gray-700">By V.C. Sports Correspondent</p>
                    </header>
                    
                    <div className="font-newspaper text-base md:text-lg text-justify space-y-5 mt-6">
                        {story.story[0] && <p>{story.story[0]}</p>}

                        <MVPFeature
                            title="Game MVP"
                            name={result.mvp.name}
                            imgSrc={result.mvp.img_url}
                            stats={`${result.mvp.stats.pts} PTS | ${result.mvp.stats.reb} REB | ${result.mvp.stats.ast} AST`}
                        />

                        {story.story.slice(1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>
                    
                    <div className="mt-10 border-t-4 border-double border-black pt-6">
                         <h3 className="font-headline text-3xl text-center mb-4 uppercase">Final Box Scores</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 md:gap-x-8">
                            <BoxScore team={result.team1} totalMinutes={result.totalMinutes} />
                            <BoxScore team={result.team2} totalMinutes={result.totalMinutes} />
                        </div>
                    </div>
                </article>
            </div>
             <div className="text-center my-6 flex flex-wrap justify-center gap-4">
                {onContinueSeries ? (
                    <>
                        <MenuButton onClick={onContinueSeries}>Back to Series</MenuButton>
                        <MenuButton onClick={onHome} variant="secondary">Main Menu</MenuButton>
                    </>
                ) : (
                    <>
                        <MenuButton onClick={onRematch}>Play Again</MenuButton>
                        <MenuButton onClick={onHome} variant="secondary">Main Menu</MenuButton>
                    </>
                )}
            </div>
        </>
    );
};

const SeriesBoxScore: React.FC<{ team: TeamSeriesStats; gameCount: number; }> = ({ team, gameCount }) => {
    const allPlayersInRoster = [...team.roster.starters, ...team.roster.bench];

    const totals = { pts: 0, reb: 0, ast: 0, pf: 0 };
    allPlayersInRoster.forEach(p => {
        const stats = team.seriesStats[p.name];
        if (stats) {
            totals.pts += stats.pts;
            totals.reb += stats.reb;
            totals.ast += stats.ast;
            totals.pf += stats.pf;
        }
    });

    const PlayerRow: React.FC<{ player: Player }> = ({ player }) => {
        const stats = team.seriesStats[player.name];
        if (!stats || gameCount === 0) return null;

        const ppg = (stats.pts / gameCount).toFixed(1);
        const rpg = (stats.reb / gameCount).toFixed(1);
        const apg = (stats.ast / gameCount).toFixed(1);

        return (
            <tr>
                <td className="py-1 px-2 font-semibold whitespace-nowrap">{player.name.split(' ').slice(-1)[0]}</td>
                <td className="py-1 px-2 text-center">{ppg}</td>
                <td className="py-1 px-2 text-center">{rpg}</td>
                <td className="py-1 px-2 text-center">{apg}</td>
            </tr>
        );
    };

    return (
        <div className="border border-black p-2 bg-white/60">
            <div className="flex items-center justify-center gap-2 mb-2">
                <img src={team.logo} alt={`${team.name} logo`} className="w-10 h-10" />
                <h4 className="text-lg font-headline text-gray-900 uppercase tracking-wider">{team.name} ({(totals.pts / (gameCount || 1)).toFixed(1)} PPG)</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-newspaper text-gray-800">
                    <thead>
                        <tr className="border-y-2 border-black bg-gray-300/50">
                            <th className="py-1 px-2 font-bold">PLAYER</th>
                            <th className="py-1 px-2 text-center font-bold">PPG</th>
                            <th className="py-1 px-2 text-center font-bold">RPG</th>
                            <th className="py-1 px-2 text-center font-bold">APG</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-400/50">
                        {team.roster.starters.sort((a, b) => (POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos))).map(p => <PlayerRow key={p.name} player={p} />)}
                        {team.roster.bench.length > 0 && (
                            <tr className="bg-gray-300/40 font-bold"><td colSpan={4} className="py-1 px-2 text-gray-600">BENCH</td></tr>
                        )}
                        {team.roster.bench.sort((a, b) => (team.seriesStats[b.name]?.pts ?? 0) - (team.seriesStats[a.name]?.pts ?? 0)).map(p => <PlayerRow key={p.name} player={p} />)}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SeriesStatsReport: React.FC<{
    winner: TeamSeriesStats;
    loser: TeamSeriesStats;
    gameCount: number;
    onClose: () => void;
}> = ({ winner, loser, gameCount, onClose }) => {
    type SortKey = 'name' | 'simPpg' | 'realPpg' | 'diffPpg' | 'simRpg' | 'realRpg' | 'diffRpg' | 'simApg' | 'realApg' | 'diffApg';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'simPpg', direction: 'desc' });

    const getDiffClass = (diff: number, threshold1: number, threshold2: number) => {
        const absDiff = Math.abs(diff);
        if (absDiff <= threshold1) return 'text-green-500';
        if (absDiff <= threshold2) return 'text-yellow-500';
        return 'text-red-500';
    };

    const processTeamData = (team: TeamSeriesStats) => {
        let players = [...team.roster.starters, ...team.roster.bench];
        let reportData = players.map(player => {
            const simStats = team.seriesStats[player.name];
            const realStats = player.career_stats;
            const simPpg = simStats ? simStats.pts / gameCount : 0;
            const simRpg = simStats ? simStats.reb / gameCount : 0;
            const simApg = simStats ? simStats.ast / gameCount : 0;
            return {
                name: player.name,
                simPpg, realPpg: realStats.ppg, diffPpg: simPpg - realStats.ppg,
                simRpg, realRpg: realStats.rpg, diffRpg: simRpg - realStats.rpg,
                simApg, realApg: realStats.apg, diffApg: simApg - realStats.apg,
            };
        });

        reportData.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return reportData;
    };

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const renderHeader = (title: string, sortKey: SortKey) => (
        <th className="py-2 px-0.5 sm:px-1 text-center font-bold cursor-pointer hover:bg-slate-700 whitespace-nowrap" onClick={() => requestSort(sortKey)}>
            {title} {sortConfig.key === sortKey ? (sortConfig.direction === 'desc' ? '↓' : '↑') : ''}
        </th>
    );

    const ReportTable: React.FC<{ team: TeamSeriesStats; title: string }> = ({ team, title }) => (
        <div className="bg-slate-800/50 p-4 rounded-xl shadow-lg border border-slate-700">
            <h4 className="text-xl font-bold mb-3 font-headline tracking-wider text-amber-400">{title}</h4>
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs sm:text-sm text-gray-300">
                    <thead>
                        <tr className="border-b-2 border-slate-600 bg-slate-700/50">
                            {renderHeader('PLAYER', 'name')}
                            {renderHeader('SIM PPG', 'simPpg')}
                            {renderHeader('REAL PPG', 'realPpg')}
                            {renderHeader('DIFF', 'diffPpg')}
                            {renderHeader('SIM RPG', 'simRpg')}
                            {renderHeader('REAL RPG', 'realRpg')}
                            {renderHeader('DIFF', 'diffRpg')}
                            {renderHeader('SIM APG', 'simApg')}
                            {renderHeader('REAL APG', 'realApg')}
                            {renderHeader('DIFF', 'diffApg')}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {processTeamData(team).map((p, index) => (
                            <tr key={index} className="hover:bg-slate-800">
                                <td className="py-2 px-2 font-semibold whitespace-nowrap">{p.name}</td>
                                <td className="py-2 px-0.5 sm:px-1 text-center font-mono">{p.simPpg.toFixed(1)}</td>
                                <td className="py-2 px-0.5 sm:px-1 text-center font-mono text-slate-400">{p.realPpg.toFixed(1)}</td>
                                <td className={`py-2 px-0.5 sm:px-1 text-center font-mono font-bold ${getDiffClass(p.diffPpg, 2, 5)}`}>{p.diffPpg.toFixed(1)}</td>
                                <td className="py-2 px-0.5 sm:px-1 text-center font-mono">{p.simRpg.toFixed(1)}</td>
                                <td className="py-2 px-0.5 sm:px-1 text-center font-mono text-slate-400">{p.realRpg.toFixed(1)}</td>
                                <td className={`py-2 px-0.5 sm:px-1 text-center font-mono font-bold ${getDiffClass(p.diffRpg, 1, 2.5)}`}>{p.diffRpg.toFixed(1)}</td>
                                <td className="py-2 px-0.5 sm:px-1 text-center font-mono">{p.simApg.toFixed(1)}</td>
                                <td className="py-2 px-0.5 sm:px-1 text-center font-mono text-slate-400">{p.realApg.toFixed(1)}</td>
                                <td className={`py-2 px-0.5 sm:px-1 text-center font-mono font-bold ${getDiffClass(p.diffApg, 1, 2.5)}`}>{p.diffApg.toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900/95 backdrop-blur-lg rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col border border-slate-700">
                <header className="p-4 border-b border-slate-700/80 flex justify-between items-center">
                    <h3 className="text-2xl font-bold font-headline text-amber-400">Simulation Balance Report</h3>
                    <button onClick={onClose} className="text-2xl font-bold hover:text-amber-400">&times;</button>
                </header>
                <main className="p-4 overflow-y-auto custom-scrollbar space-y-6">
                    <ReportTable team={winner} title={`${winner.name} (Series Winner)`} />
                    <ReportTable team={loser} title={loser.name} />
                </main>
                <footer className="p-4 border-t border-slate-700/80">
                    <MenuButton onClick={onClose} variant="secondary" className="w-full">Close Report</MenuButton>
                </footer>
            </div>
        </div>
    );
};

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-t-4 border-double border-black pt-6 mt-10">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left font-headline text-3xl mb-4 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black/50 focus:ring-offset-2 focus:ring-offset-[#F3F0E9]"
            >
                <span>{title}</span>
                <span className={`transform transition-transform duration-300 text-2xl ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && <div className="animate-fade-in space-y-6">{children}</div>}
        </div>
    );
};


const SeriesEndScreen: React.FC<{
    winner: TeamSeriesStats;
    loser: TeamSeriesStats;
    gameResults: GameResult[];
    onRematch: () => void;
    onHome: () => void;
    isHistorical: boolean;
}> = ({ winner, loser, gameResults, onRematch, onHome, isHistorical }) => {

    const [showReport, setShowReport] = useState(false);
    const seriesMVP = useMemo(() => calculateSeriesMVP(winner, gameResults.length), [winner, gameResults.length]);
    const [story, setStory] = useState<NewspaperStory>(() => ({
        ...generateStaticSeriesStory(winner, loser, seriesMVP, gameResults),
        isAIGenerated: false
    }));
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const seriesScore = `${winner.wins}-${loser.wins}`;

    const loadStory = useCallback(async () => {
        if (isGeminiAvailable()) {
            setIsLoadingAI(true);
            try {
                const aiStory = await generateAISeriesStory(winner, loser, seriesMVP, gameResults);
                setStory(aiStory);
            } catch (e) {
                console.error('Failed to generate AI series story:', e);
            } finally {
                setIsLoadingAI(false);
            }
        }
    }, [winner, loser, seriesMVP, gameResults]);

    useEffect(() => {
        loadStory();
    }, [loadStory]);

    return (
        <>
            <BackButton onClick={onHome} />
            <div className="newspaper-bg text-black p-4 sm:p-6 md:p-10 rounded-lg shadow-2xl my-8">
                <article>
                    <header className="text-center border-b-4 border-black pb-4 mb-4">
                        <img src="https://raw.githubusercontent.com/niwde787/basketball-legends/main/newspapper.png" alt="The Virtual Chronicle" className="mx-auto h-16 md:h-20 mb-4" />
                        <div className="flex justify-center items-center gap-2 mb-2">
                            {isLoadingAI && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-full animate-pulse border border-amber-400">
                                    ✍️ Generating AI Series Chronicle...
                                </span>
                            )}
                            {!isLoadingAI && story.isAIGenerated && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                                    ✨ AI Chronicle (Gemini)
                                </span>
                            )}
                            {!isLoadingAI && isGeminiAvailable() && (
                                <button
                                    onClick={loadStory}
                                    title="Regenerate with Gemini AI"
                                    className="text-xs font-semibold px-2.5 py-0.5 bg-black/10 hover:bg-black/20 text-gray-800 rounded-full transition-colors border border-black/20"
                                >
                                    🔄 Regenerate
                                </button>
                            )}
                        </div>
                        <h1 className="font-headline text-2xl sm:text-4xl md:text-5xl my-2 text-gray-900">{story.headline}</h1>
                        <h2 className="font-newspaper text-lg sm:text-xl md:text-2xl text-gray-800">{story.subheadline}</h2>
                        <p className="text-sm italic mt-4 text-gray-700">The Final Result: {seriesScore}</p>
                    </header>

                    <div className="font-newspaper text-base md:text-lg text-justify space-y-5 mt-6">
                        {story.story[0] && <p>{story.story[0]}</p>}

                        <MVPFeature
                            title="Series MVP"
                            name={seriesMVP.name}
                            imgSrc={seriesMVP.stats.img_url}
                            stats={`SERIES AVG: ${seriesMVP.stats.ppg.toFixed(1)} PTS | ${seriesMVP.stats.rpg.toFixed(1)} REB | ${seriesMVP.stats.apg.toFixed(1)} AST`}
                        />

                        {story.story.slice(1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>

                    <div className="mt-10 border-t-4 border-double border-black pt-6">
                        <h3 className="font-headline text-3xl text-center mb-4 uppercase">Series Averages</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 md:gap-x-8">
                            <SeriesBoxScore team={winner} gameCount={gameResults.length} />
                            <SeriesBoxScore team={loser} gameCount={gameResults.length} />
                        </div>
                    </div>
                    
                    <CollapsibleSection title="Game-by-Game Box Scores">
                        {gameResults.map((game) => (
                            <div key={game.gameNumber} className="border border-black/20 p-4 bg-black/5 rounded-lg">
                                <h4 className="font-headline text-xl text-center mb-2">
                                    Game {game.gameNumber}: {game.winner.name} wins {game.score}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 md:gap-x-8">
                                    <BoxScore team={game.team1} totalMinutes={game.totalMinutes} />
                                    <BoxScore team={game.team2} totalMinutes={game.totalMinutes} />
                                </div>
                            </div>
                        ))}
                    </CollapsibleSection>

                </article>
            </div>
            <div className="text-center my-6 flex flex-wrap justify-center gap-4">
                <MenuButton onClick={onRematch}>Play Again</MenuButton>
                {isHistorical && <MenuButton onClick={() => setShowReport(true)} variant="secondary">View Balance Report</MenuButton>}
                <MenuButton onClick={onHome} variant="secondary">Main Menu</MenuButton>
            </div>
            {showReport && <SeriesStatsReport winner={winner} loser={loser} gameCount={gameResults.length} onClose={() => setShowReport(false)} />}
        </>
    );
};

export default App;