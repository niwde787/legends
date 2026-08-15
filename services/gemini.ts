import { GameResult, TeamSeriesStats } from '../types';
import { generateStaticGameStory, generateStaticSeriesStory } from './templateGenerator';

export interface NewspaperStory {
    headline: string;
    subheadline: string;
    story: string[];
    isAIGenerated: boolean;
}

// Global state to track availability to prevent blocking on every call
let geminiAvailabilityStatus: boolean | null = null;

export async function checkGeminiAvailability(): Promise<boolean> {
    try {
        const response = await fetch('/api/ai/status');
        if (response.ok) {
            const data = await response.json();
            geminiAvailabilityStatus = data.available;
            return data.available;
        }
        geminiAvailabilityStatus = false;
        return false;
    } catch (err) {
        geminiAvailabilityStatus = false;
        return false;
    }
}

export function isGeminiAvailable(): boolean {
    return Boolean(geminiAvailabilityStatus);
}

export async function generateAIGameStory(result: GameResult): Promise<NewspaperStory> {
    const fallback = generateStaticGameStory(result);

    try {
        const response = await fetch('/api/ai/story/game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ result })
        });
        
        if (!response.ok) {
            throw new Error('Backend AI request failed');
        }

        const parsed = await response.json();
        
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

    try {
        const response = await fetch('/api/ai/story/series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ winner, loser, seriesMVP, gameResults })
        });

        if (!response.ok) {
            throw new Error('Backend AI request failed');
        }

        const parsed = await response.json();

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
