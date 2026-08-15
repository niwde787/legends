import { GameResult, TeamSeriesStats } from '../types';

// --- GAME STORY TEMPLATES ---

const gameTemplates = [
    // Template 1: MVP Dominance
    {
        headline: "{{mvpName}}'s Masterpiece Lifts {{winnerName}} Over {{loserName}}",
        subheadline: "A stunning {{mvpPts}}-point performance by the MVP seals a hard-fought {{score}} victory.",
        story: [
            "From the opening tip, it was a battle of titans as the {{winnerName}} and the {{loserName}} traded blows in a classic encounter. The arena was electric, with the halftime score at a knife's edge of {{halftimeScore}}, setting the stage for a dramatic second half.",
            "The turning point came midway through the fourth quarter. It was {{mvpName}} who took over, scoring or assisting on 10 straight points to create a gap the {{loserName}} couldn't close. Despite a valiant effort from their stars, they had no answer for the MVP's relentless attack.",
            "In the end, it was a tale of one player's sheer will to win. {{mvpName}}'s final stat line of {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists only tells part of the story. Their leadership and clutch play were the undeniable difference, cementing this victory in the annals of virtual basketball history."
        ]
    },
    // Template 2: Defensive Grind
    {
        headline: "{{winnerName}} Grind Out Tough {{score}} Win Against {{loserName}} in Defensive Struggle",
        subheadline: "{{mvpName}} shines on both ends of the floor to secure the victory in a low-scoring affair.",
        story: [
            "It wasn't pretty, but it was a win. The {{winnerName}} clawed their way to victory in a game defined by tough defense and physical play. Both teams struggled to find their rhythm offensively, as evidenced by the {{halftimeScore}} halftime score.",
            "Points were at a premium all night, with every possession contested. The pivotal moments came from hustle plays and defensive stops, not high-flying dunks. It was {{mvpName}} who provided just enough offensive spark, hitting crucial shots when his team needed them most.",
            "While {{loserName}} fought admirably, their offense ultimately sputtered against the relentless pressure. The {{winnerName}}'s game plan was clear: win with defense. With a final stat line of {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists, {{mvpName}} proved to be the difference-maker in a true throwback contest."
        ]
    },
    // Template 3: Offensive Shootout
    {
        headline: "FIREWORKS! {{winnerName}} Outlast {{loserName}} {{score}} in Offensive Explosion",
        subheadline: "The scoreboard operator worked overtime as {{mvpName}} led his team with a blistering {{mvpPts}}-point barrage.",
        story: [
            "Fans who love scoring got their money's worth tonight. The {{winnerName}} and {{loserName}} engaged in a breathtaking offensive shootout, with both teams trading baskets at a furious pace. The defense was optional as the halftime score ballooned to {{halftimeScore}}.",
            "The game was a highlight reel of incredible shots and dazzling passes. While several players had big nights, it was {{mvpName}} who shone brightest. His ability to score from anywhere on the court was the driving force behind his team's success.",
            "Ultimately, the {{loserName}} just couldn't keep pace with the offensive juggernaut. {{mvpName}}'s performance, totaling {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists, was simply too much to overcome in a game that will be remembered for its sheer scoring volume."
        ]
    },
    // Template 4: Comeback Story
    {
        headline: "STUNNING COMEBACK! {{winnerName}} Rally to Defeat {{loserName}} {{score}}",
        subheadline: "{{mvpName}} engineers a miraculous second-half turnaround to snatch victory from the jaws of defeat.",
        story: [
            "It looked bleak for the {{winnerName}} at halftime, trailing {{halftimeScore}} and searching for answers. The {{loserName}} were in complete control, executing their game plan to perfection through the first two quarters.",
            "But basketball is a game of two halves. A fiery speech in the locker room must have worked, as the {{winnerName}} came out with renewed energy. Led by the indomitable {{mvpName}}, they chipped away at the lead, possession by possession, culminating in a dramatic fourth quarter surge.",
            "The {{loserName}} were left shell-shocked, unable to stop the momentum. {{mvpName}} was the hero, finishing with {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists, but this victory was the definition of a total team effort, a testament to their resilience and belief."
        ]
    },
    // Template 5: Down to the Wire
    {
        headline: "NAIL-BITER! {{winnerName}} Edge {{loserName}} {{score}} in a Thriller",
        subheadline: "A last-second defensive stop secures the win after a back-and-forth battle led by MVP {{mvpName}}.",
        story: [
            "The tension in the arena was palpable as the {{winnerName}} and {{loserName}} fought tooth and nail for 48 minutes. The game featured an incredible {{leadChanges}} lead changes, with neither team able to build a significant advantage.",
            "Every possession felt critical, especially in the final minutes. {{mvpName}} was immense, carrying his team's offense and making big plays down the stretch. He finished with a spectacular line of {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists.",
            "It all came down to the final play. With the {{loserName}} needing a basket to win, the {{winnerName}} defense stood tall, forcing a tough miss as the buzzer sounded. It was a fittingly dramatic end to an unforgettable contest."
        ]
    },
     // Template 6: Statement Win
    {
        headline: "DOMINANCE! {{winnerName}} Make a Statement with {{score}} Rout of {{loserName}}",
        subheadline: "{{mvpName}} was simply unstoppable, leading his squad to a commanding victory from start to finish.",
        story: [
            "This was a message. The {{winnerName}} put the league on notice with a dominant performance, dismantling the {{loserName}} from the opening whistle. They established control early, racing out to a {{halftimeScore}} lead and never looking back.",
            "The contest was never in doubt. The {{winnerName}} clicked on all cylinders, showcasing superior execution and teamwork. The undisputed leader of the charge was {{mvpName}}, who played a near-perfect game.",
            "{{loserName}} had no answers and seemed a step slow all night. {{mvpName}}'s final numbers of {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists highlight a performance that was as efficient as it was brilliant, capping a true statement victory."
        ]
    },
    // Template 7: A Game of Runs
    {
        headline: "{{winnerName}} Withstand Furious Rally to Hold Off {{loserName}}, {{score}}",
        subheadline: "After a wild game of runs, MVP {{mvpName}}'s poise in the clutch proved to be the deciding factor.",
        story: [
            "This was a game of massive momentum swings. The {{winnerName}} looked poised to run away with it early, but the {{loserName}} stormed back with a huge run in the second quarter to make the halftime score a tight {{halftimeScore}}.",
            "The second half was just as volatile, with both teams trading haymakers. Just when one team seemed to pull away, the other would answer. Through it all, {{mvpName}} was the steadying force for the eventual victors.",
            "In the crucial final minutes, it was {{mvpName}}'s veteran leadership that settled his team. He made the right play time and time again, finishing with {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists to ensure his team had the final say in this rollercoaster of a game."
        ]
    },
    // Template 8: Battle of the Bigs
    {
        headline: "Clash of Titans: {{mvpName}}'s Interior Presence Overpowers {{loserName}} in {{score}} Win",
        subheadline: "The game was decided in the paint, where the {{winnerName}}'s MVP dominated the glass and the scoreboard.",
        story: [
            "Tonight's contest was a throwback, a physical battle won in the trenches. The {{winnerName}} leveraged their size and strength inside, with {{mvpName}} leading the charge against a formidable {{loserName}} front line.",
            "The game's narrative was written on the low block. {{mvpName}} was a force of nature, demanding double teams and creating opportunities for his teammates all night. His work on the offensive glass was particularly soul-crushing for the opposition.",
            "While the {{loserName}} battled hard, they couldn't overcome the sheer dominance of {{mvpName}} in the paint. His final line of {{mvpPts}} points and a staggering {{mvpReb}} rebounds tells the story of a player who imposed his will and carried his team to a hard-earned victory."
        ]
    },
    // Template 9: Bench Mob Steps Up
    {
        headline: "Depth Prevails: {{winnerName}}'s Bench Unit Sparks {{score}} Victory Over {{loserName}}",
        subheadline: "While MVP {{mvpName}} led the way, it was the stellar play of the second unit that made the difference.",
        story: [
            "Championships are won with depth, and the {{winnerName}} proved that tonight. While the starters battled the {{loserName}} to a virtual standstill, as seen by the {{halftimeScore}} score, the game turned whenever the bench units checked in.",
            "The {{winnerName}}'s reserves provided a massive spark of energy, extending the lead with hustle, defense, and timely scoring. This allowed the starters, including the phenomenal {{mvpName}}, to get crucial rest without losing ground.",
            "{{loserName}}'s bench, in contrast, couldn't match the intensity. {{mvpName}} rightfully earned his MVP honors with {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists, but this was a victory forged by the entire roster, a true team win from top to bottom."
        ]
    },
    // Template 10: The Misfire
    {
        headline: "{{winnerName}} Survive Off-Night to Topple {{loserName}} {{score}}",
        subheadline: "{{mvpName}} does just enough to carry his cold-shooting team to an ugly, but important, win.",
        story: [
            "It was a frustrating night for shooters on both sides, but the {{winnerName}} found a way to win ugly. Neither team could find the bottom of the net with any consistency, leading to a gritty, low-scoring affair.",
            "The ball just wouldn't drop, but {{mvpName}} refused to let his team lose. He scrapped for loose balls, got to the free-throw line, and made plays for others when his own shot wasn't falling consistently.",
            "The {{loserName}} will rue their missed opportunities, as this game was theirs for the taking. But credit the {{winnerName}} and their leader, {{mvpName}}, who gutted out a tough performance, finishing with {{mvpPts}} points, {{mvpReb}} rebounds, and {{mvpAst}} assists to prove that sometimes, you just have to find a way."
        ]
    }
];

// --- SERIES STORY TEMPLATES ---

const seriesTemplates = [
    // Template 1: Dominant Sweep
    {
        headline: "A LEAGUE OF THEIR OWN: {{winnerName}} Sweep {{loserName}} to Claim Championship",
        subheadline: "{{seriesMvpName}} was transcendent, leading his team to a dominant {{seriesScore}} series victory.",
        story: [
            "It was a coronation. The {{winnerName}} left no doubt about who the superior team was, completing a stunning sweep of the {{loserName}} to hoist the virtual championship trophy. From Game 1, they looked like a team on a mission, playing with near-perfect chemistry and execution.",
            "The undisputed king of the court was Series MVP {{seriesMvpName}}. He was a man possessed, averaging an incredible {{seriesMvpPpg}} points, {{seriesMvpRpg}} rebounds, and {{seriesMvpApg}} assists per game. He controlled every facet of the series, and the {{loserName}} simply had no answer.",
            "This series wasn't just a win; it was a statement. The {{winnerName}} have etched their names in history with one of the most dominant postseason runs ever witnessed, a flawless performance that will be celebrated for ages."
        ]
    },
    // Template 2: Epic 7-Game Thriller
    {
        headline: "SEVEN GAMES OF GLORY! {{winnerName}} Emerge Victorious in Epic {{seriesScore}} Finals",
        subheadline: "In a series for the ages, {{seriesMvpName}}'s heroics in Game 7 carried the {{winnerName}} past the valiant {{loserName}}.",
        story: [
            "This is what legends are made of. After a grueling, back-and-forth seven-game war, the {{winnerName}} are the last team standing. This series had everything: dramatic comebacks, overtime thrillers, and iconic performances from superstars on both sides.",
            "When his team needed him most, in the crucible of a Game 7, it was Series MVP {{seriesMvpName}} who rose to the occasion. He delivered a signature performance to close out the series, capping an incredible run where he averaged {{seriesMvpPpg}} points, {{seriesMvpRpg}} rebounds, and {{seriesMvpApg}} assists.",
            "Credit is due to the {{loserName}}, who fought with heart and tenacity until the very end. But in the final moments, the {{winnerName}} and their leader found another gear, making the clutch plays that define champions. This series will not soon be forgotten."
        ]
    },
    // Template 3: The Gentleman's Sweep (4-1)
    {
        headline: "CROWNED! {{winnerName}} Dispatch {{loserName}} in Five Games, {{seriesScore}}",
        subheadline: "Series MVP {{seriesMvpName}} proved too much to handle as his squad closed out the series with authority.",
        story: [
            "While the {{loserName}} managed to steal a game, this series ultimately belonged to the {{winnerName}}. They demonstrated their superiority throughout, securing the championship with a convincing 4-1 series victory, a performance of focused dominance.",
            "The engine behind their success was {{seriesMvpName}}, who was named Series MVP for his consistent brilliance. Averaging {{seriesMvpPpg}} points per game, he was the best player on the floor in every contest, punishing the defense and elevating his teammates.",
            "The {{loserName}} showed flashes of their potential, but the {{winnerName}} were simply too deep, too talented, and too led by their incredible MVP. They are deserving champions, having answered every challenge thrown their way."
        ]
    },
    // Template 4: Coming Back from a Deficit (e.g., 1-2 or 0-2)
    {
        headline: "ROAR FROM BEHIND: {{winnerName}} Overturn Deficit to Win Title Over {{loserName}} {{seriesScore}}",
        subheadline: "Down early in the series, {{seriesMvpName}} inspired a historic comeback to capture the championship.",
        story: [
            "Don't ever count out the heart of a champion. After falling into an early series hole, the {{winnerName}} looked vulnerable. But they dug deep, showed their resolve, and stormed back to win the championship in stunning fashion.",
            "The catalyst for the turnaround was the unwavering leadership of Series MVP {{seriesMvpName}}. With his team's back against the wall, he played his best basketball, refusing to lose and inspiring his teammates with his play on both ends of the floor. His series averages of {{seriesMvpPpg}} PPG and {{seriesMvpRpg}} RPG were simply heroic.",
            "This victory is a testament to their mental fortitude. The {{loserName}} will be left wondering what could have been, but the story of these finals will be the incredible resilience of the {{winnerName}}, the worthy and undisputed champions."
        ]
    },
     // Template 5: A War of Attrition (4-2)
    {
        headline: "SURVIVORS! {{winnerName}} Claim Title After Grueling Six-Game Battle With {{loserName}}",
        subheadline: "In a physical and hard-fought series, MVP {{seriesMvpName}}'s consistent excellence was the deciding factor in the {{seriesScore}} victory.",
        story: [
            "Every game was a war. The {{winnerName}} earned their championship rings by outlasting a tough and resilient {{loserName}} squad in a grueling six-game series. This was not a series for the faint of heart, with every point and every rebound fiercely contested.",
            "Through the physical grind, one player stood above the rest: Series MVP {{seriesMvpName}}. He was the model of consistency, a rock for his team who delivered night after night, finishing the series with stellar averages of {{seriesMvpPpg}} points and {{seriesMvpApg}} assists.",
            "The {{loserName}} pushed them to the brink, but the {{winnerName}} proved they had the toughness and talent to weather the storm. They are champions forged in the fire of intense competition, and they have earned their place at the top."
        ]
    }
];

// --- GENERATOR FUNCTIONS ---

const fillTemplate = (template: string, data: Record<string, string>) => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
};

export const generateStaticGameStory = (result: GameResult) => {
    const template = gameTemplates[Math.floor(Math.random() * gameTemplates.length)];
    
    const data = {
        winnerName: result.winner.name,
        loserName: result.loser.name,
        score: result.score,
        halftimeScore: result.halftimeScore,
        mvpName: result.mvp.name,
        mvpPts: result.mvp.stats.pts.toString(),
        mvpReb: result.mvp.stats.reb.toString(),
        mvpAst: result.mvp.stats.ast.toString(),
        leadChanges: result.leadChanges.toString()
    };

    return {
        headline: fillTemplate(template.headline, data),
        subheadline: fillTemplate(template.subheadline, data),
        story: template.story.map(p => fillTemplate(p, data)),
    };
};

export const generateStaticSeriesStory = (
    winner: TeamSeriesStats, 
    loser: TeamSeriesStats,
    seriesMVP: any,
    gameResults: GameResult[]
) => {
    let template;
    const seriesScore = `${winner.wins}-${loser.wins}`;

    if (winner.wins === 4 && loser.wins === 0) {
        template = seriesTemplates.find(t => t.headline.includes("Sweep"));
    } else if (winner.wins === 4 && loser.wins === 3) {
        template = seriesTemplates.find(t => t.headline.includes("Seven Games"));
    } else if (winner.wins === 4 && loser.wins === 1) {
        template = seriesTemplates.find(t => t.headline.includes("Five Games"));
    } else if (winner.wins === 4 && loser.wins === 2) {
        template = seriesTemplates.find(t => t.headline.includes("Six-Game"));
    } else {
        template = seriesTemplates[Math.floor(Math.random() * seriesTemplates.length)];
    }

    if (!template) { // Fallback
        template = seriesTemplates[0];
    }
    
    const data = {
        winnerName: winner.name,
        loserName: loser.name,
        seriesScore: seriesScore,
        seriesMvpName: seriesMVP.name,
        seriesMvpPpg: seriesMVP.stats.ppg.toFixed(1),
        seriesMvpRpg: seriesMVP.stats.rpg.toFixed(1),
        seriesMvpApg: seriesMVP.stats.apg.toFixed(1),
    };

    return {
        headline: fillTemplate(template.headline, data),
        subheadline: fillTemplate(template.subheadline, data),
        story: template.story.map(p => fillTemplate(p, data)),
    };
};