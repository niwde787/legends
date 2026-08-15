import { GoogleGenAI, Type } from '@google/genai';
import { GameResult, TeamSeriesStats } from '../types';
import { generateStaticGameStory, generateStaticSeriesStory } from './templateGenerator';

export interface NewspaperStory {
    headline: string;
    subheadline: string;
    story: string[];
    isAIGenerated: boolean;
}

function getApiKey(): string {
    return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
}

export function isGeminiAvailable(): boolean {
    const key = getApiKey();
    return Boolean(key && key.trim().length > 0);
}

export async function checkGeminiAvailability(): Promise<boolean> {
    return isGeminiAvailable();
}

let aiInstance: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
    const key = getApiKey();
    if (!key) return null;
    if (!aiInstance) {
        aiInstance = new GoogleGenAI({ apiKey: key });
    }
    return aiInstance;
}

export async function generateAIGameStory(result: GameResult): Promise<NewspaperStory> {
    const fallback = generateStaticGameStory(result);
    const ai = getAIClient();

    if (!ai) {
        return {
            ...fallback,
            isAIGenerated: false
        };
    }

    try {
        const prompt = `You are a veteran 1990s sports journalist writing the lead front-page recap for 'The Virtual Chronicle'.
Write an evocative, authentic, newspaper-style game report for this legendary basketball simulation.

Game Details:
- Matchup: ${result.winner.name} def. ${result.loser.name}
- Final Score: ${result.score} (Winner: ${result.winner.name})
- Halftime Score: ${result.halftimeScore}
- Total Lead Changes: ${result.leadChanges}
- Total Duration: ${result.totalMinutes} minutes
- Game MVP: ${result.mvp.name} with ${result.mvp.stats.pts} points, ${result.mvp.stats.reb} rebounds, ${result.mvp.stats.ast} assists.

Format your response as a JSON object with:
- headline: A dramatic, vintage all-caps sports headline (e.g. 'JORDAN'S MASTERPIECE SEALS THRILLER AS BULLS TOP LAKERS').
- subheadline: A punchy one-sentence summary subtitle.
- story: An array of 3 rich, journalistic paragraphs (first paragraph setting the atmosphere and stakes, second covering the pivotal momentum swings and defensive battles, third celebrating the MVP's heroic performance and legacy).`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        headline: { type: Type.STRING },
                        subheadline: { type: Type.STRING },
                        story: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['headline', 'subheadline', 'story']
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from Gemini');

        const parsed = JSON.parse(text);
        if (parsed.headline && parsed.subheadline && Array.isArray(parsed.story) && parsed.story.length > 0) {
            return {
                headline: parsed.headline,
                subheadline: parsed.subheadline,
                story: parsed.story,
                isAIGenerated: true
            };
        }
        throw new Error('Invalid schema from Gemini');
    } catch (err) {
        console.warn('Gemini game story generation failed, falling back to static template:', err);
        return {
            ...fallback,
            isAIGenerated: false
        };
    }
}

export async function generateAISeriesStory(
    winner: TeamSeriesStats,
    loser: TeamSeriesStats,
    seriesMVP: any,
    gameResults: GameResult[]
): Promise<NewspaperStory> {
    const fallback = generateStaticSeriesStory(winner, loser, seriesMVP, gameResults);
    const ai = getAIClient();

    if (!ai) {
        return {
            ...fallback,
            isAIGenerated: false
        };
    }

    try {
        const seriesScore = `${winner.wins}-${loser.wins}`;
        const gamesSummary = gameResults.map(g => `Game ${g.gameNumber}: ${g.winner.name} won (${g.score}), MVP: ${g.mvp.name} (${g.mvp.stats.pts}pts)`).join('; ');

        const prompt = `You are a veteran sports columnist writing the commemorative championship issue for 'The Virtual Chronicle'.
Write a legendary recap of this Best-of-7 playoff series.

Series Details:
- Series Winner: ${winner.name} (${winner.wins} wins)
- Series Runner-up: ${loser.name} (${loser.wins} wins)
- Final Series Result: ${seriesScore}
- Series MVP: ${seriesMVP.name} with series averages of ${seriesMVP.stats.ppg.toFixed(1)} PPG, ${seriesMVP.stats.rpg.toFixed(1)} RPG, ${seriesMVP.stats.apg.toFixed(1)} APG.
- Game-by-game summary: ${gamesSummary}

Format your response as a JSON object with:
- headline: An iconic championship all-caps headline.
- subheadline: An evocative subheadline detailing the conquest.
- story: An array of 3 rich, journalistic paragraphs (first recapping the championship coronation and series stakes, second analyzing the tactical battles and turning points across games, third celebrating the Series MVP's immortality in basketball lore).`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        headline: { type: Type.STRING },
                        subheadline: { type: Type.STRING },
                        story: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['headline', 'subheadline', 'story']
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from Gemini');

        const parsed = JSON.parse(text);
        if (parsed.headline && parsed.subheadline && Array.isArray(parsed.story) && parsed.story.length > 0) {
            return {
                headline: parsed.headline,
                subheadline: parsed.subheadline,
                story: parsed.story,
                isAIGenerated: true
            };
        }
        throw new Error('Invalid schema from Gemini');
    } catch (err) {
        console.warn('Gemini series story generation failed, falling back to static template:', err);
        return {
            ...fallback,
            isAIGenerated: false
        };
    }
}
