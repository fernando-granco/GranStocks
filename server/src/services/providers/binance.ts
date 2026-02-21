import WebSocket from 'ws';
import { CacheService } from '../cache';

const BINANCE_REST_BASE_URL = process.env.BINANCE_REST_BASE_URL || 'https://api.binance.com';
const BINANCE_WS_BASE_URL = process.env.BINANCE_WS_BASE_URL || 'wss://stream.binance.com:9443';

export class BinanceProvider {
    private static ws: WebSocket | null = null;
    private static trackedSymbols: Set<string> = new Set();
    private static memoryCache: Map<string, any> = new Map();
    private static reconnectTimeout: NodeJS.Timeout | null = null;

    static initWebSocket() {
        if (this.ws) return;

        this.ws = new WebSocket(`${BINANCE_WS_BASE_URL}/ws`);

        this.ws.on('open', () => {
            console.log('🔗 Binance WebSocket connected.');
            this.subscribeToTracked();
        });

        this.ws.on('message', async (data: string) => {
            try {
                const parsed = JSON.parse(data);
                // Listen for 24hr ticker or miniTicker
                // e.g. { e: '24hrTicker', s: 'BTCUSDT', c: '40000', p: '240', P: '1.2' }
                if (parsed.e === '24hrTicker') {
                    const symbol = parsed.s;
                    const payload = {
                        symbol,
                        assetType: 'CRYPTO',
                        price: parseFloat(parsed.c),
                        changeAbs: parseFloat(parsed.p),
                        changePct: parseFloat(parsed.P),
                        ts: parsed.E,
                        source: 'BINANCE_WS',
                        isStale: false
                    };

                    // Update Hot cache immediately
                    this.memoryCache.set(`quote:${symbol}`, payload);

                    // Throttle SQLite writes (e.g. only every 5 seconds per symbol)
                    const lastDbWrite = this.memoryCache.get(`dbwrite:${symbol}`) || 0;
                    if (Date.now() - lastDbWrite > 5000) {
                        await CacheService.setCacheConfig(`quote:${symbol}`, JSON.stringify(payload), 60, 'BINANCE_WS');
                        this.memoryCache.set(`dbwrite:${symbol}`, Date.now());
                    }
                }
            } catch (e) {
                // Ignore parse errors safely
            }
        });

        this.ws.on('close', () => {
            console.log('🔴 Binance WebSocket disconnected, reconnecting in 5s...');
            this.ws = null;
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => this.initWebSocket(), 5000);
        });

        this.ws.on('error', (err: Error) => {
            console.error('Binance WS Error:', err);
        });
    }

    private static subscribeToTracked() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.trackedSymbols.size === 0) return;

        const params = Array.from(this.trackedSymbols).map(s => `${s.toLowerCase()}@ticker`);
        this.ws.send(JSON.stringify({
            method: 'SUBSCRIBE',
            params: params,
            id: 1
        }));
    }

    static trackSymbol(symbol: string) {
        if (!this.trackedSymbols.has(symbol)) {
            this.trackedSymbols.add(symbol);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    method: 'SUBSCRIBE',
                    params: [`${symbol.toLowerCase()}@ticker`],
                    id: Date.now()
                }));
            } else if (!this.ws) {
                this.initWebSocket();
            }
        }
    }

    static async getQuote(symbol: string) {
        this.trackSymbol(symbol);

        // Check hot cache first
        const mem = this.memoryCache.get(`quote:${symbol}`);
        if (mem) return mem;

        // Fallback to SQLite cache
        const cached = await CacheService.getCacheConfig(`quote:${symbol}`);
        if (cached && !cached.isStale) {
            return JSON.parse(cached.payloadJson);
        }

        // Ultimate Fallback: REST API
        try {
            const res = await fetch(`${BINANCE_REST_BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`);
            if (!res.ok) throw new Error(`Binance REST HTTP ${res.status}`);
            const data = await res.json();

            const payload = {
                symbol: data.symbol,
                assetType: 'CRYPTO',
                price: parseFloat(data.lastPrice),
                changeAbs: parseFloat(data.priceChange),
                changePct: parseFloat(data.priceChangePercent),
                ts: data.closeTime,
                source: 'BINANCE_REST',
                isStale: false
            };

            await CacheService.setCacheConfig(`quote:${symbol}`, JSON.stringify(payload), 60, 'BINANCE_REST');
            return payload;
        } catch (e) {
            console.error(`Error fetching Binance REST quote for ${symbol}`, e);
            if (cached) {
                const stale = JSON.parse(cached.payloadJson);
                stale.isStale = true;
                return stale;
            }
            throw new Error('No crypto quote available');
        }
    }

    static async getCandles(symbol: string, interval: string, limit: number = 180) {
        // Map common timeframes to Binance standard (1d, 1h, 4h)
        const cacheKey = `candle:binance:${symbol}:${interval}:${limit}`;
        // check cache
        const cached = await CacheService.getCacheConfig(cacheKey);
        if (cached && !cached.isStale) return JSON.parse(cached.payloadJson);

        try {
            const res = await fetch(`${BINANCE_REST_BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
            if (!res.ok) throw new Error('Failed to fetch Binance klines');
            const data: any[][] = await res.json();

            // Normalize to format expected by analysis logic: {s: ok, c: [], h: [], l: [], o: [], t: [], v: []}
            const payload = {
                s: 'ok',
                t: data.map(k => Math.floor(k[0] / 1000)),
                o: data.map(k => parseFloat(k[1])),
                h: data.map(k => parseFloat(k[2])),
                l: data.map(k => parseFloat(k[3])),
                c: data.map(k => parseFloat(k[4])),
                v: data.map(k => parseFloat(k[5])),
                source: 'BINANCE_REST'
            };

            await CacheService.setCacheConfig(cacheKey, JSON.stringify(payload), 300, 'BINANCE_REST'); // 5min cache
            return payload;
        } catch (err) {
            console.error(`Error fetching Binance candles for ${symbol}`, err);
            return { s: 'error' };
        }
    }
}
