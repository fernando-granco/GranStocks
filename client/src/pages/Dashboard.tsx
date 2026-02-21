import { useQuery, useMutation } from '@tanstack/react-query';
import { Server, Play } from 'lucide-react';
import { cn } from '../utils';
import { useAuth } from '../context/AuthContext';

export default function Dashboard({ onSelect }: { onSelect: (symbol: string, assetType: string) => void }) {
    const { user } = useAuth();

    const { data: overviews, isLoading } = useQuery({
        queryKey: ['overview'],
        queryFn: async () => {
            const res = await fetch('/api/overview/today');
            if (res.status === 401) throw new Error('Unauthorized');
            if (!res.ok) throw new Error('Network error');
            return res.json();
        },
        refetchInterval: 30000 // Poll every 30s as requested
    });

    const runJobMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/run-daily', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to start daily job');
        },
        onSuccess: () => {
            alert('Daily Analysis Job started in the background. Check back in a few minutes!');
        }
    });

    if (isLoading) return <div className="text-center py-20 text-neutral-500 animate-pulse">Loading market data...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Market Overview</h1>
                {user?.role === 'ADMIN' && (
                    <button
                        onClick={() => runJobMutation.mutate()}
                        disabled={runJobMutation.isPending}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Play size={16} /> Run Daily Job
                    </button>
                )}
            </div>

            {!overviews || overviews.length === 0 ? (
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20">
                    <Server className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">No assets tracked</h3>
                    <p className="text-neutral-500 mt-1">Go to settings to add symbols to your portfolio.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {overviews.map((item: any) => (
                        <div
                            key={item.symbol}
                            onClick={() => onSelect(item.symbol, item.assetType)}
                            className="group p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800/80 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex justify-between items-start mb-4">
                                <h1 className="text-2xl font-bold">{item.symbol}</h1>
                                {item.prediction?.[0] && (
                                    <span className={cn(
                                        "px-2.5 py-1 text-xs font-medium rounded-full",
                                        item.prediction[0].predictedReturnPct > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {item.prediction[0].predictedReturnPct > 0 ? 'Bullish' : 'Bearish'} Bias
                                    </span>
                                )}
                            </div>

                            {item.indicators ? (() => {
                                const ind = JSON.parse(item.indicators.indicatorsJson);
                                return (
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-sm text-neutral-500 mb-0.5">Last Price</div>
                                            <div className="text-xl font-mono">${ind.lastPrice.toFixed(2)}</div>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">RSI: {ind.rsi14 ? ind.rsi14.toFixed(1) : '-'}</span>
                                            <span className="text-neutral-400">Vol: {ind.vol20 ? (ind.vol20 * 100).toFixed(1) + '%' : '-'}</span>
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="text-sm text-neutral-500">Awaiting chron job...</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
