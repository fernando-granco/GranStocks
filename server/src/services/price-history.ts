import { prisma } from './cache';
import { MarketData } from './market-data';
import { DailyCandles } from './analysis';

export class PriceHistoryService {

    /**
     * Backfill 2 years of daily candles for a symbol.
     * Safe to call multiple times — uses upsert, so no duplicates.
     */
    static async backfillSymbol(symbol: string, assetType: 'STOCK' | 'CRYPTO'): Promise<number> {
        console.log(`[PriceHistory] Backfilling ${symbol} (${assetType})...`);

        const candles = await MarketData.getCandles(symbol, assetType, '2y');
        if (!candles || candles.s !== 'ok' || !candles.c || candles.c.length === 0) {
            console.warn(`[PriceHistory] No data returned for ${symbol}`);
            return 0;
        }

        let inserted = 0;
        for (let i = 0; i < candles.t.length; i++) {
            const date = new Date(candles.t[i] * 1000).toISOString().split('T')[0];
            try {
                await prisma.priceHistory.upsert({
                    where: { symbol_date: { symbol, date } },
                    update: {
                        open: candles.o[i],
                        high: candles.h[i],
                        low: candles.l[i],
                        close: candles.c[i],
                        volume: candles.v[i],
                        assetType
                    },
                    create: {
                        symbol,
                        assetType,
                        date,
                        open: candles.o[i],
                        high: candles.h[i],
                        low: candles.l[i],
                        close: candles.c[i],
                        volume: candles.v[i]
                    }
                });
                inserted++;
            } catch (e) {
                // Skip individual rows that fail
            }
        }

        console.log(`[PriceHistory] Stored ${inserted} candles for ${symbol}`);
        return inserted;
    }

    /**
     * Append just today's candle. Called nightly by the scheduler.
     */
    static async appendLatestCandle(symbol: string, assetType: 'STOCK' | 'CRYPTO'): Promise<void> {
        try {
            const candles = await MarketData.getCandles(symbol, assetType, '5d');
            if (!candles || candles.s !== 'ok' || !candles.c || candles.c.length === 0) return;

            // Use the last candle (most recent trading day)
            const i = candles.c.length - 1;
            const date = new Date(candles.t[i] * 1000).toISOString().split('T')[0];
            await prisma.priceHistory.upsert({
                where: { symbol_date: { symbol, date } },
                update: {
                    open: candles.o[i],
                    high: candles.h[i],
                    low: candles.l[i],
                    close: candles.c[i],
                    volume: candles.v[i]
                },
                create: {
                    symbol,
                    assetType,
                    date,
                    open: candles.o[i],
                    high: candles.h[i],
                    low: candles.l[i],
                    close: candles.c[i],
                    volume: candles.v[i]
                }
            });
            console.log(`[PriceHistory] Updated latest candle for ${symbol} on ${date}`);
        } catch (e: any) {
            console.error(`[PriceHistory] Failed to append candle for ${symbol}: ${e.message}`);
        }
    }

    /**
     * Read cached candles from DB and return in DailyCandles format.
     * Falls back to live API if the cache is empty.
     */
    static async getCandles(symbol: string, assetType: 'STOCK' | 'CRYPTO', days: number): Promise<DailyCandles | null> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffDate = cutoff.toISOString().split('T')[0];

        const rows = await prisma.priceHistory.findMany({
            where: { symbol, date: { gte: cutoffDate } },
            orderBy: { date: 'asc' }
        });

        if (rows.length < 20) {
            // Cache miss — fall back to live API and opportunistically cache
            console.warn(`[PriceHistory] Cache miss for ${symbol}, falling back to live API`);
            try {
                const candles = await MarketData.getCandles(symbol, assetType, days >= 365 ? '2y' : days >= 180 ? '6m' : '3m');
                if (candles && candles.s === 'ok' && candles.c?.length > 0) {
                    // Store in background (don't await — don't block the response)
                    this.backfillSymbol(symbol, assetType).catch(() => { });
                    return candles;
                }
            } catch (e) { /* ignore */ }
            return null;
        }

        // Convert to DailyCandles format
        return {
            c: rows.map(r => r.close),
            h: rows.map(r => r.high),
            l: rows.map(r => r.low),
            o: rows.map(r => r.open),
            v: rows.map(r => r.volume),
            t: rows.map(r => Math.floor(new Date(r.date + 'T16:00:00Z').getTime() / 1000)),
            s: 'ok'
        } as DailyCandles & { s: string };
    }

    /**
     * Count cached candles for a symbol. Useful for health checks.
     */
    static async getCandleCount(symbol: string): Promise<number> {
        return prisma.priceHistory.count({ where: { symbol } });
    }

    /**
     * List all distinct symbols in the cache.
     */
    static async getCachedSymbols(): Promise<string[]> {
        const result = await prisma.priceHistory.findMany({
            distinct: ['symbol'],
            select: { symbol: true }
        });
        return result.map(r => r.symbol);
    }
}
