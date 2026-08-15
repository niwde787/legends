import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to get API key on server
  function getApiKey(): string {
    return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
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

  // API route to check if Gemini is available
  app.get("/api/ai/status", (req, res) => {
    const isAvailable = Boolean(getApiKey() && getApiKey().trim().length > 0);
    res.json({ available: isAvailable });
  });

  // API route for game story
  app.post("/api/ai/story/game", async (req, res) => {
    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({ error: "Gemini API key not configured" });
    }

    try {
      const { result } = req.body;
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
      res.json(parsed);
    } catch (err) {
      console.error('Gemini game story generation failed:', err);
      res.status(500).json({ error: 'Failed to generate story' });
    }
  });

  // API route for series story
  app.post("/api/ai/story/series", async (req, res) => {
    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({ error: "Gemini API key not configured" });
    }

    try {
      const { winner, loser, seriesMVP, gameResults } = req.body;
      const seriesScore = `${winner.wins}-${loser.wins}`;
      const gamesSummary = gameResults.map((g: any) => `Game ${g.gameNumber}: ${g.winner.name} won (${g.score}), MVP: ${g.mvp.name} (${g.mvp.stats.pts}pts)`).join('; ');

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
      res.json(parsed);
    } catch (err) {
      console.error('Gemini series story generation failed:', err);
      res.status(500).json({ error: 'Failed to generate story' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
