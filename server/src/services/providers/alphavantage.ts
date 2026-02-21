import { CacheService } from '../cache';

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY || '';
const ALPHAVANTAGE_BASE_URL = process.env.ALPHAVANTAGE_BASE_URL || 'https://www.alphavantage.co/query';

// Rate Limiting: free tier is 25 per day, premium is higher.
export class AlphaVantageProvider {

    static async getQuote(symbol: string) {
        const cacheKey = `quote:av:${symbol}`;
        const cached = await CacheService.getCacheConfig(cacheKey);
        if (cached && !cached.isStale) return JSON.parse(cached.payloadJson);

        try {
            const url = `${ALPHAVANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHAVANTAGE_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`AV Error ${res.status}`);
            const data = await res.json();

            if (data['Note'] || data['Information']) throw new Error('API limit reached');
            const quote = data['Global Quote'];
            if (!quote || !quote['05. price']) throw new Error('No quote data');

            const payload = {
                symbol,
                assetType: 'STOCK',
                price: parseFloat(quote['05. price']),
                changeAbs: parseFloat(quote['09. change']),
                changePct: parseFloat(quote['10. change percent'].replace('%', '')),
                ts: new Date(quote['07. latest trading day']).getTime(),
                source: 'ALPHAVANTAGE',
                isStale: false
            };

            // 15 minute cache to spare rate limit
            await CacheService.setCacheConfig(cacheKey, JSON.stringify(payload), 900, 'ALPHAVANTAGE');
            return payload;
        } catch (e) {
            console.warn(`[AlphaVantage] Quote generic error for ${symbol}`, e);
            throw e; // throw up to market-data unified router to trigger fallback
        }
    }

    static async getCandles(symbol: string, isIntraday: boolean = false) {
        const cacheKey = `candle:av:${symbol}:${isIntraday ? 'intraday' : 'daily'}`;
        const cached = await CacheService.getCacheConfig(cacheKey);
        if (cached && !cached.isStale) return JSON.parse(cached.payloadJson);

        try {
            const func = isIntraday ? 'TIME_SERIES_INTRADAY' : 'TIME_SERIES_DAILY_ADJUSTED';
            const intervalParam = isIntraday ? '&interval=60min' : '';
            const url = `${ALPHAVANTAGE_BASE_URL}?function=${func}&symbol=${symbol}&outputsize=full${intervalParam}&apikey=${ALPHAVANTAGE_API_KEY}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data['Note'] || data['Information']) throw new Error('API limit reached');

            const timeSeriesKey = Object.keys(data).find(k => k.includes('Time Series'));
            if (!timeSeriesKey) throw new Error('Invalid AV format');

            const ts = data[timeSeriesKey];
            const dates = Object.keys(ts).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

            // Normalize to {s, t, o, h, l, c, v}
            const payload = {
                s: 'ok',
                t: dates.map(d => Math.floor(new Date(d).getTime() / 1000)),
                o: dates.map(d => parseFloat(ts[d]['1. open'])),
                h: dates.map(d => parseFloat(ts[d]['2. high'])),
                l: dates.map(d => parseFloat(ts[d]['3. low'])),
                c: dates.map(d => parseFloat(ts[d]['4. close'] || ts[d]['4. adjusted close'])),
                v: dates.map(d => parseFloat(ts[d]['6. volume'] || ts[d]['5. volume'])),
                source: 'ALPHAVANTAGE'
            };

            await CacheService.setCacheConfig(cacheKey, JSON.stringify(payload), isIntraday ? 1800 : 86400, 'ALPHAVANTAGE');
            return payload;
        } catch (e) {
            console.warn(`[AlphaVantage] Candle fetch error for ${symbol}`);
            throw e;
        }
    }

    static async getOverview(symbol: string) {
        const cacheKey = `overview:av:${symbol}`;
        const cached = await CacheService.getCacheConfig(cacheKey);
        if (cached && !cached.isStale) return JSON.parse(cached.payloadJson);

        try {
            const url = `${ALPHAVANTAGE_BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHAVANTAGE_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data['Note'] || data['Information']) throw new Error('API limit reached');
            if (Object.keys(data).length === 0) throw new Error('No overview found');

            await CacheService.setCacheConfig(cacheKey, JSON.stringify(data), 86400 * 7, 'ALPHAVANTAGE'); // 7 days
            return data;
        } catch (e) {
            console.warn(`[AlphaVantage] Overview fetch error for ${symbol}`);
            throw e;
        }
    }
}
