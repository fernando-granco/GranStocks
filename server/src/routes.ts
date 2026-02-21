import { FastifyInstance } from 'fastify';
import { prisma } from './services/cache';
import { MarketData } from './services/market-data';
import { LLMService } from './services/llm';
import { DailyJobService } from './services/scheduler';
import { ScreenerService } from './services/screener';
import { encryptText } from './utils/crypto';
import z from 'zod';

export async function registerRoutes(server: FastifyInstance) {

    // --- Tracked Asset Selection ---
    server.post('/api/tracked-assets', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase().min(1).max(10).regex(/^[A-Z0-9.-]+$/) });
        const { symbol } = schema.parse(req.body);

        // Quick validate against MarketData
        const profile = await MarketData.getOverview(symbol, 'STOCK');
        if (!profile || Object.keys(profile).length === 0) {
            return reply.status(400).send({ error: 'Invalid symbol or not found.' });
        }

        const displayName = profile.Name || profile.name || symbol;
        const exchange = profile.Exchange || profile.exchange || '';

        await prisma.asset.upsert({
            where: { symbol },
            update: { displayName, isActive: true },
            create: { symbol, displayName, exchange }
        });

        const authUser = req.user as { id: string };

        try {
            await prisma.trackedAsset.create({
                data: { userId: authUser.id, symbol }
            });
            return { success: true, symbol };
        } catch (e) {
            return reply.status(409).send({ error: 'Asset already tracked' });
        }
    });

    server.get('/api/tracked-assets', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };
        const selections = await prisma.trackedAsset.findMany({
            where: { userId: authUser.id },
            include: { user: false } // Only simple details
        });
        return selections;
    });

    server.delete('/api/tracked-assets/:symbol', { preValidation: [server.authenticate] }, async (req, reply) => {
        const { symbol } = req.params as { symbol: string };
        const authUser = req.user as { id: string };

        // Delete from selection
        await prisma.trackedAsset.deleteMany({
            where: { userId: authUser.id, symbol }
        });
        return { success: true };
    });

    // --- Market Data Pull-through (Proxy to Cache/Providers) ---
    server.get('/api/data/quote', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getQuote(symbol, assetType);
    });

    server.get('/api/data/candles', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK'),
            // Using simplified range strings now for MarketData unified router
            range: z.string().default('6m')
        });
        const { symbol, assetType, range } = schema.parse(req.query);
        return await MarketData.getCandles(symbol, assetType, range);
    });

    server.get('/api/data/profile', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getOverview(symbol, assetType);
    });

    server.get('/api/data/metrics', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getMetrics(symbol, assetType);
    });

    server.get('/api/data/news', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK')
        });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getNews(symbol, assetType);
    });

    // --- AI Configuration ---
    server.post('/api/settings/llm', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            name: z.string(),
            provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK', 'GROQ', 'TOGETHER', 'OLLAMA', 'OPENAI_COMPAT']),
            apiKey: z.string().min(1),
            model: z.string(),
            baseUrl: z.string().optional()
        });

        const { name, provider, apiKey, model, baseUrl } = schema.parse(req.body);
        const authUser = req.user as { id: string };

        const encryptedApiKey = encryptText(apiKey);
        const keyLast4 = apiKey.length > 4 ? apiKey.slice(-4) : apiKey;

        const config = await prisma.userLLMConfig.create({
            data: {
                userId: authUser.id,
                name,
                provider,
                model,
                baseUrl,
                encryptedApiKey,
                keyLast4
            }
        });

        return { id: config.id, name: config.name, provider: config.provider, keyLast4: config.keyLast4 };
    });

    server.get('/api/settings/llm', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };

        const configs = await prisma.userLLMConfig.findMany({
            where: { userId: authUser.id },
            select: { id: true, name: true, provider: true, model: true, keyLast4: true, baseUrl: true }
        });
        return configs;
    });

    // --- Deterministic Outputs & Asset Summary API ---
    server.get('/api/asset/summary', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK'),
            dateHour: z.string().optional() // YYYY-MM-DDTHH:00
        });
        const { symbol, assetType, dateHour } = schema.parse(req.query);

        const dh = dateHour || new Date().toISOString().substring(0, 13) + ':00';

        // 1. Get raw quote & candles
        const quote = await MarketData.getQuote(symbol, assetType);
        // default 6m range for daily candles
        const candles = await MarketData.getCandles(symbol, assetType, '6m');

        // 2. Fetch specific Indicator & Prediction snapshots
        // Try exact date match first, fallback to latest
        const todayDate = dh.split('T')[0];
        let ind = await prisma.indicatorSnapshot.findFirst({
            where: { symbol, date: todayDate }
        });
        if (!ind) {
            ind = await prisma.indicatorSnapshot.findFirst({
                where: { symbol },
                orderBy: { date: 'desc' }
            });
        }

        // 3. Fetch Firm View deterministic roles (AnalysisSnapshot)
        const firmView = await prisma.analysisSnapshot.findMany({
            where: { symbol, assetType } // Simplified fetch to just get latest available context
        });

        // 4. Transform firmView into a lookup dictionary by role
        const roles: Record<string, string> = {};
        firmView.forEach((f: any) => {
            roles[f.role] = f.payloadJson;
        });

        return {
            quote,
            candles,
            indicators: ind ? JSON.parse(ind.indicatorsJson) : null,
            firmView: roles
        };
    });

    server.get('/api/overview/today', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };

        const selections = await prisma.trackedAsset.findMany({
            where: { userId: authUser.id },
            include: { user: false } // Only simple details
        });

        // Fetch asset metadata for assetType mapping manually if include asset is tricky
        const assets = await prisma.asset.findMany({
            where: { symbol: { in: selections.map(s => s.symbol) } }
        });
        const assetMap = new Map(assets.map(a => [a.symbol, a.type]));

        const symbols = selections.map(s => s.symbol);

        // Get latest predictions and indicators for selected symbols
        const results = await Promise.all(symbols.map(async sym => {
            const pred = await prisma.predictionSnapshot.findMany({
                where: { symbol: sym },
                orderBy: { date: 'desc' },
                take: 3 // up to 3 horizons
            });
            const ind = await prisma.indicatorSnapshot.findFirst({
                where: { symbol: sym },
                orderBy: { date: 'desc' }
            });
            return { symbol: sym, assetType: assetMap.get(sym) || 'STOCK', prediction: pred, indicators: ind };
        }));

        return results;
    });


    // --- Screener API ---
    server.get('/api/screener/:universe', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({ universe: z.enum(['SP500', 'NASDAQ100', 'CRYPTO']) });
        const { universe } = schema.parse(req.params);

        // Get Job state
        const jobState = await prisma.jobState.findUnique({ where: { id: universe } });

        // Get snapshots
        const snapshots = await prisma.screenerSnapshot.findMany({
            where: { universeName: universe },
            orderBy: { score: 'desc' },
            take: 25
        });

        return { state: jobState, topCandidates: snapshots };
    });

    // --- AI Generation Orchestration ---
    server.post('/api/ai/generate', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            date: z.string(),
            symbols: z.array(z.string()),
            llmConfigIds: z.array(z.string()),
            force: z.boolean().optional()
        });
        const { date, symbols, llmConfigIds, force } = schema.parse(req.body);

        const authUser = req.user as { id: string };

        const results: any[] = [];

        // For each selected model, generate narratives side-by-side
        for (const configId of llmConfigIds) {
            for (const symbol of symbols) {
                // Check if already exists unless forced
                if (!force) {
                    const existing = await prisma.aiNarrative.findFirst({
                        where: { llmConfigId: configId, symbol, dateHour: date }
                    });
                    if (existing) {
                        results.push(existing);
                        continue;
                    }
                }

                // Fetch deterministic context from DB (Prediction + Firm View Roles)
                const predContext = await prisma.predictionSnapshot.findFirst({
                    where: { symbol, date, horizonDays: 20 }
                });

                const firmView = await prisma.analysisSnapshot.findMany({
                    where: { symbol }
                });

                if (!predContext && firmView.length === 0) continue; // No base context to generate from

                const assembledContext = {
                    baselinePrediction: predContext?.explanationText || 'No ML baseline',
                    firmViewRoles: firmView.map(f => ({ role: f.role, summary: JSON.parse(f.payloadJson) }))
                };

                const narrativeText = await LLMService.generateNarrative(configId, symbol, date, JSON.stringify(assembledContext, null, 2));

                const config = await prisma.userLLMConfig.findUnique({ where: { id: configId } });

                const narrative = await prisma.aiNarrative.create({
                    data: {
                        userId: authUser.id,
                        symbol,
                        dateHour: date,
                        llmConfigId: configId,
                        contentText: narrativeText,
                        providerUsed: config!.provider,
                        modelUsed: config!.model
                    }
                });

                results.push(narrative);
            }
        }

        return results;
    });

    // --- Admin ---
    server.post('/api/admin/run-daily', { preValidation: [server.requireAdmin] }, async (req, reply) => {
        const schema = z.object({ date: z.string().optional() });
        const { date } = schema.parse(req.query);

        // Fire-and-forget job execution internally
        setImmediate(() => {
            DailyJobService.runDailyJob(date).catch(console.error);
        });

        return { status: "Job queued" };
    });

    server.post('/api/admin/screener/run', { preValidation: [server.requireAdmin] }, async (req, reply) => {
        const schema = z.object({
            universe: z.enum(['SP500', 'NASDAQ100', 'CRYPTO']),
            date: z.string()
        });
        const { universe, date } = schema.parse(req.body);

        // Check if already running
        const jobState = await prisma.jobState.findUnique({ where: { id: universe } });
        if (jobState && jobState.status === 'RUNNING') {
            return reply.status(409).send({ error: 'Screener job is already running for this universe.' });
        }

        // Fire-and-forget job execution
        setImmediate(() => {
            ScreenerService.runScreenerJob(universe, date).catch(console.error);
        });

        return { status: "Screener job queued", universe };
    });
}
