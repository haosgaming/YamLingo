import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function handleGeminiError(err: unknown, res: express.Response) {
  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/\b(400|401|403|404|429|500|503)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : 500;
  let friendly = 'Nepodařilo se spojit se službou Gemini AI.';
  if (status === 403 || status === 401 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
    friendly = 'API klíč Gemini není platný nebo chybí oprávnění v panelu Settings > Secrets.';
  } else if (status === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) {
    friendly = 'Kvóta Gemini API byla vyčerpána. Zkuste to za chvíli nebo zkontrolujte Settings > Secrets.';
  }
  res.status(status).json({ error: friendly, detail: msg });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(getGeminiClient()) });
  });

  // 1. YAML Doctor: Fix & Explain (High Thinking Mode)
  app.post('/api/yaml-doctor/fix', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY není nakonfigurován v prostředí serveru. Nastavte jej v Settings > Secrets.',
      });
      return;
    }

    const yamlCode = typeof req.body?.yaml === 'string' ? req.body.yaml : '';
    const contextHint = typeof req.body?.context === 'string' ? req.body.context : 'Home Assistant / ESPHome';
    if (!yamlCode.trim()) {
      res.status(400).json({ error: 'Vložte prosím YAML kód k analýze.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyzuj a oprav následující YAML konfiguraci pro ${contextHint}.
Zaměř se na:
1. Syntaktické chyby (tabulátory, špatné odsazení, chybějící dvojtečky, špatné uvozovky).
2. Logické chyby specifické pro Home Assistant a ESPHome (např. entity_id přímo pod action místo pod target:, zastaralé service: bez akce nebo chybějící alias, neplatné GPIO piny na ESP32, chybějící I2C piny nebo Jinja2 chyby).
3. Zachovej původní záměr uživatele a vrať čistý, funkční YAML s 2-mezerovým odsazením.

Původní YAML:
\`\`\`yaml
${yamlCode}
\`\`\``,
        config: {
          systemInstruction:
            'Jsi seniorní diagnostik pro Home Assistant a ESPHome YAML. Odpovídej výhradně česky, lidsky a přátelsky (bez zbytečného žargonu). Vrať striktně validní JSON podle schématu.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fixedYaml: {
                type: Type.STRING,
                description: 'Opravený, čistý YAML kód s 2-mezerovým odsazením.',
              },
              summary: {
                type: Type.STRING,
                description: 'Stručné shrnutí toho, co bylo v konfiguraci špatně a jak je to opraveno (česky).',
              },
              changes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    line: { type: Type.INTEGER, description: 'Číslo řádku v původním kódu' },
                    issue: { type: Type.STRING, description: 'Název chyby česky' },
                    explanation: { type: Type.STRING, description: 'Lidské vysvětlení opravy česky' },
                  },
                },
              },
            },
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // 2. Google Search Grounding: Ověřit v dokumentaci Home Assistant / ESPHome
  app.post('/api/yaml-doctor/search', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY není nakonfigurován v prostředí serveru. Nastavte jej v Settings > Secrets.',
      });
      return;
    }

    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const yamlSnippet = typeof req.body?.yaml === 'string' ? req.body.yaml.slice(0, 1200) : '';
    if (!query) {
      res.status(400).json({ error: 'Zadejte prosím dotaz pro vyhledání v dokumentaci.' });
      return;
    }

    try {
      const prompt = yamlSnippet
        ? `Dotaz uživatele: "${query}"\nKontext YAML kódu:\n\`\`\`yaml\n${yamlSnippet}\n\`\`\`\nVyhledej aktuální oficiální dokumentaci Home Assistant nebo ESPHome a stručně česky odpověz s praktickým YAML příkladem.`
        : `Vyhledej aktuální oficiální dokumentaci Home Assistant nebo ESPHome k dotazu: "${query}". Odpověz stručně česky s konkrétním YAML příkladem.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((c: { web?: { uri?: string; title?: string } }) => c.web)
        .filter((w): w is { uri: string; title: string } => Boolean(w?.uri));

      res.json({
        answer: response.text ?? '',
        sources,
      });
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // 3. Google Maps Grounding: Lokální prodejny součástek / elektro pro ESP32 & Smart Home
  app.post('/api/yaml-doctor/maps', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY není nakonfigurován v prostředí serveru. Nastavte jej v Settings > Secrets.',
      });
      return;
    }

    const query =
      typeof req.body?.query === 'string' && req.body.query.trim()
        ? req.body.query.trim()
        : 'Kde koupit ESP32 vývojovou desku, BME280 senzor a chytré relé v okolí?';

    const lat = typeof req.body?.latitude === 'number' ? req.body.latitude : 50.0755;
    const lng = typeof req.body?.longitude === 'number' ? req.body.longitude : 14.4378;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${query} Odpověz stručně česky a uveď doporučená místa pro nákup elektroniky nebo chytré domácnosti.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          },
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const places = chunks
        .map((c) => {
          if (!c.maps?.uri) return null;
          const snippets = (c.maps.placeAnswerSources?.reviewSnippets ?? [])
            .map((r) => {
              const rec = r as { content?: string; title?: string };
              return rec.content || rec.title || '';
            })
            .filter(Boolean);
          return {
            title: c.maps.title || 'Otevřít v Google Maps',
            uri: c.maps.uri,
            snippets,
          };
        })
        .filter(Boolean);

      res.json({
        answer: response.text ?? '',
        places,
      });
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`YAMLingo server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
