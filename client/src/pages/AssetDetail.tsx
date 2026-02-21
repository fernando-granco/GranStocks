import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Cpu, AlertTriangle, Sparkles, Activity, ShieldAlert, BarChart3, Database } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../utils';

export default function AssetDetail({ symbol, assetType, onBack }: { symbol: string, assetType: 'STOCK' | 'CRYPTO', onBack: () => void }) {
    const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
    const [generatedNarratives, setGeneratedNarratives] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'CHART' | 'TECHNICAL' | 'FUNDAMENTAL' | 'RISK' | 'FIRM_VIEW'>('CHART');

    const { data: summary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['assetSummary', symbol, assetType],
        queryFn: async () => {
            const res = await fetch(`/api/asset/summary?symbol=${symbol}&assetType=${assetType}`);
            if (!res.ok) throw new Error('Failed to fetch summary');
            return res.json();
        }
    });

    const { data: configs } = useQuery({
        queryKey: ['llmConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/llm');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const aiMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    symbols: [symbol],
                    llmConfigIds: selectedProviders,
                    force: false
                })
            });
            if (!res.ok) throw new Error('Failed to generate AI narrative');
            return res.json();
        },
        onSuccess: (data) => {
            setGeneratedNarratives(data);
        }
    });

    const toggleProvider = (id: string) => {
        if (selectedProviders.includes(id)) {
            setSelectedProviders(v => v.filter(i => i !== id));
        } else {
            setSelectedProviders(v => [...v, id]);
        }
    };

    // Prepare chart data format
    const chartData = summary?.candles?.t ? summary.candles.t.map((timestamp: number, idx: number) => ({
        date: new Date(timestamp * 1000).toLocaleDateString(),
        price: summary.candles.c[idx],
    })) : [];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={onBack} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                &larr; Back to Dashboard
            </button>

            {isLoadingSummary ? (
                <div className="h-64 flex items-center justify-center animate-pulse text-neutral-500">Loading comprehensive analytics...</div>
            ) : summary ? (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h1 className="text-4xl font-bold flex items-center gap-3">
                                {symbol}
                                <span className={cn("text-sm px-2 py-0.5 rounded-full font-semibold", assetType === 'CRYPTO' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400')}>{assetType}</span>
                            </h1>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-2xl font-mono">${summary.quote?.price?.toFixed(2)}</span>
                                <span className={cn("text-lg font-medium", summary.quote?.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                    {summary.quote?.changePct >= 0 ? '+' : ''}{summary.quote?.changePct?.toFixed(2)}%
                                </span>
                                <span className="text-xs text-neutral-500 flex items-center gap-1"><Database size={12} /> {summary.quote?.source}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Deterministic Panel */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar border-b border-neutral-800">
                                <TabButton active={activeTab === 'CHART'} onClick={() => setActiveTab('CHART')} icon={<BarChart3 size={16} />}>Price Action</TabButton>
                                <TabButton active={activeTab === 'TECHNICAL'} onClick={() => setActiveTab('TECHNICAL')} icon={<Activity size={16} />}>Technicals</TabButton>
                                <TabButton active={activeTab === 'RISK'} onClick={() => setActiveTab('RISK')} icon={<ShieldAlert size={16} />}>Risk Flags</TabButton>
                                <TabButton active={activeTab === 'FIRM_VIEW'} onClick={() => setActiveTab('FIRM_VIEW')} icon={<Database size={16} />}>Firm View Roles</TabButton>
                            </div>

                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 min-h-[400px]">
                                {activeTab === 'CHART' && (
                                    <div className="h-[350px] w-full">
                                        {chartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                                    <XAxis dataKey="date" stroke="#525252" fontSize={12} tickMargin={10} minTickGap={30} />
                                                    <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} tickFormatter={v => `$${v}`} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                                        itemStyle={{ color: '#a78bfa' }}
                                                    />
                                                    <Line type="monotone" dataKey="price" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#818cf8', stroke: '#312e81', strokeWidth: 2 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                                                <AlertTriangle className="mb-2 h-8 w-8 text-neutral-600" />
                                                <p>Chart data unavailable from provider</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'TECHNICAL' && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Technical Indicators</h3>
                                        {summary.indicators ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                <MetricCard label="RSI (14)" value={summary.indicators.rsi14?.toFixed(2)} />
                                                <MetricCard label="MACD" value={summary.indicators.macd?.macd?.toFixed(3)} />
                                                <MetricCard label="Volatility (20d)" value={`${(summary.indicators.vol20 * 100).toFixed(2)}%`} />
                                                <MetricCard label="Trend (20/50)" value={summary.indicators.sma20 > summary.indicators.sma50 ? 'BULLISH' : 'BEARISH'} />
                                            </div>
                                        ) : (
                                            <p className="text-neutral-500">No technical indicators computed yet. Run the daily job.</p>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'RISK' && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-rose-400 border-b border-rose-900/50 pb-2">Risk Analysis</h3>
                                        {summary.indicators ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <MetricCard label="Drawdown from Peak" value={`${(summary.indicators.drawdown * 100).toFixed(2)}%`} isNegative={true} />
                                                <MetricCard label="Data Freshness" value={summary.quote?.isStale ? "STALE" : "LIVE"} isNegative={summary.quote?.isStale} />
                                            </div>
                                        ) : (
                                            <p className="text-neutral-500">No risk metrics computed yet.</p>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'FIRM_VIEW' && (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <h3 className="text-lg font-semibold text-indigo-400 border-b border-indigo-900/50 pb-2">Analysis Snapshot (Deterministic)</h3>
                                        {summary.firmView && Object.keys(summary.firmView).length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {Object.entries(summary.firmView).map(([role, payloadStr]) => {
                                                    let parsed;
                                                    try { parsed = JSON.parse(payloadStr as string); } catch (e) { parsed = { "raw": payloadStr }; }
                                                    return (
                                                        <div key={role} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                                                            <div className="text-xs uppercase font-bold text-indigo-400 mb-2">{role}</div>
                                                            <div className="text-sm font-mono text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                                                                {JSON.stringify(parsed, null, 2)}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-neutral-500">No firm view analysis snapshots built for this asset today.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Panel */}
                        <div className="bg-neutral-900/50 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)] rounded-2xl p-6 flex flex-col h-[600px] overflow-hidden">
                            <h3 className="text-lg font-semibold mb-4 border-b border-indigo-500/20 pb-2 flex items-center gap-2">
                                <Cpu className="text-indigo-400" size={18} /> LLM Intelligence
                            </h3>

                            {(!configs || configs.length === 0) ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                    <p className="text-sm text-neutral-400">No external AI providers configured.</p>
                                    <p className="text-xs text-neutral-500">Add BYOK setups in settings to enable narrative generation safely via backend proxy.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="mb-4 space-y-2">
                                        <label className="text-sm text-neutral-400 font-medium">Select Providers to Compare</label>
                                        <div className="flex flex-wrap gap-2">
                                            {configs.map((cfg: any) => (
                                                <button
                                                    key={cfg.id}
                                                    onClick={() => toggleProvider(cfg.id)}
                                                    className={cn(
                                                        "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                                                        selectedProviders.includes(cfg.id)
                                                            ? "bg-indigo-500 border-indigo-500 text-white"
                                                            : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500"
                                                    )}
                                                >
                                                    {cfg.name} ({cfg.provider})
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => aiMutation.mutate()}
                                        disabled={selectedProviders.length === 0 || aiMutation.isPending}
                                        className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium rounded-lg transition-all w-full flex items-center justify-center gap-2"
                                    >
                                        {aiMutation.isPending ? 'Generating...' : <><Sparkles size={16} /> Compare Narratives</>}
                                    </button>

                                    {aiMutation.isError && (
                                        <p className="text-rose-400 text-sm mt-2 font-medium">Error: {(aiMutation.error as any).message}</p>
                                    )}

                                    <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                        {generatedNarratives.length > 0 ? (
                                            generatedNarratives.map((n: any, idx) => (
                                                <div key={idx} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                                                    <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-2">
                                                        {n.providerUsed}
                                                    </div>
                                                    <div className="prose prose-invert prose-sm">
                                                        {n.contentText}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-center px-4">
                                                <p className="text-xs text-neutral-500 italic">
                                                    Prompts are composed strictly of deterministic numerical data. No secret keys are exposed client-side.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-20 text-rose-400">Failed to load asset data.</div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, children, icon }: { active: boolean, onClick: () => void, children: React.ReactNode, icon?: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-2 font-medium text-sm whitespace-nowrap rounded-t-lg border-b-2 flex items-center gap-2 transition-colors",
                active ? "border-indigo-500 text-indigo-400 bg-indigo-500/10" : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
            )}
        >
            {icon}
            {children}
        </button>
    );
}

function MetricCard({ label, value, isNegative }: { label: string, value: string | undefined, isNegative?: boolean }) {
    return (
        <div className={cn("p-4 rounded-xl border bg-neutral-900/50", isNegative ? "border-rose-900/30" : "border-neutral-800")}>
            <div className="text-xs text-neutral-500 uppercase font-semibold tracking-wider mb-1">{label}</div>
            <div className={cn("text-lg font-medium", isNegative ? "text-rose-400" : "text-neutral-200")}>{value || '-'}</div>
        </div>
    );
}
