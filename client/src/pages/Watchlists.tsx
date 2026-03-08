import React, { useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Save, Trash2, ShieldAlert, Star, Layers, X, Briefcase } from 'lucide-react';


export default function Watchlists() {
    const { mode } = usePreferences();
    const queryClient = useQueryClient();

    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Portfolio Add Position Modal
    const [showPortfolioModalFor, setShowPortfolioModalFor] = useState<any | null>(null);
    const [formPortfolioId, setFormPortfolioId] = useState('');
    const [formQty, setFormQty] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formAcquiredAt, setFormAcquiredAt] = useState('');
    const [formFees, setFormFees] = useState('');

    const { data: portfolios = [] } = useQuery({
        queryKey: ['portfolios'],
        queryFn: async () => {
            const res = await fetch('/api/portfolio/list');
            if (!res.ok) return [];
            return res.json();
        }
    });

    // For bulk Universe creation
    const [selectedSymbols, setSelectedSymbols] = useState<any[]>([]);
    const [universeName, setUniverseName] = useState('');

    // Fetch user's tracked assets
    const { data: trackedAssets = [] } = useQuery({
        queryKey: ['tracked-assets'],
        queryFn: async () => {
            const res = await fetch('/api/tracked-assets');
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Fetch user's custom universes
    const { data: universes = [] } = useQuery({
        queryKey: ['universes'],
        queryFn: async () => {
            const res = await fetch('/api/universes');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const handleSearch = async () => {
        if (!searchQ.trim()) return;
        setIsSearching(true);
        try {
            const params = new URLSearchParams({ q: searchQ });
            const res = await fetch(`/api/assets/search?${params.toString()}`);
            const data = await res.json();
            setSearchResults(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const trackMutation = useMutation({
        mutationFn: async (asset: any) => {
            const res = await fetch('/api/tracked-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: asset.symbol, assetType: asset.assetType || 'STOCK' })
            });
            if (!res.ok) throw new Error('Failed to track asset');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tracked-assets'] });
        }
    });

    const untrackMutation = useMutation({
        mutationFn: async (symbol: string) => {
            const res = await fetch(`/api/tracked-assets/${symbol}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to untrack asset');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tracked-assets'] });
        }
    });

    const createUniverseMutation = useMutation({
        mutationFn: async () => {
            if (!universeName || selectedSymbols.length === 0) throw new Error('Missing data');
            const res = await fetch('/api/universes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: universeName,
                    universeType: 'STOCK', // Unified type for custom lists
                    definitionJson: JSON.stringify({ symbols: selectedSymbols.map(s => ({ symbol: s.symbol, assetType: s.assetType })) })
                })
            });
            if (!res.ok) throw new Error('Failed to create universe');
        },
        onSuccess: () => {
            setUniverseName('');
            setSelectedSymbols([]);
            queryClient.invalidateQueries({ queryKey: ['universes'] });
        }
    });

    const deleteUniverseMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`/api/universes/${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['universes'] });
        }
    });

    const addPortfolioMutation = useMutation({
        mutationFn: async (vars: { portfolioId: string, symbol: string, assetType: string, quantity: number, averageCost: number, acquiredAt?: string, fees?: number }) => {
            const res = await fetch('/api/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vars)
            });
            if (!res.ok) throw new Error('Failed to add to portfolio');
        },
        onSuccess: () => {
            setShowPortfolioModalFor(null);
            setFormQty('');
            setFormPrice('');
            setFormAcquiredAt('');
            setFormFees('');
            queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        }
    });

    const toggleSelection = (asset: any) => {
        setSelectedSymbols(prev => {
            const exists = prev.find(p => p.symbol === asset.symbol);
            if (exists) return prev.filter(p => p.symbol !== asset.symbol);
            return [...prev, asset];
        });
    };

    const isTracked = (symbol: string) => trackedAssets.some((a: any) => a.symbol === symbol);
    const isSelected = (symbol: string) => selectedSymbols.some((s: any) => s.symbol === symbol);

    if (mode !== 'ADVANCED') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <ShieldAlert className="w-16 h-16 text-neutral-600 mb-6" />
                <h2 className="text-2xl font-bold mb-4">Pro Feature</h2>
                <p className="text-neutral-500 mb-8">
                    The Watchlists hub requires Advanced Mode. Toggle the <span className="text-amber-500">Pro</span> switch in the navigation bar to access institutional-grade tracking and universe management.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Watchlists & Universes</h1>
            <p className="text-neutral-400">Search for Stocks or Crypto to add to your individual Tracked Assets or build Custom Universes.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Search Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl">
                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                                <input
                                    type="text"
                                    placeholder="Search 'GOOG', 'Apple', or 'BTCUSDT'..."
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                            >
                                {isSearching ? '...' : 'Search'}
                            </button>
                        </div>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-neutral-950/50 border-b border-neutral-800">
                                        <tr>
                                            <th className="p-4 w-12 text-center text-neutral-400">#</th>
                                            <th className="p-4 font-medium text-neutral-400">Symbol</th>
                                            <th className="p-4 font-medium text-neutral-400">Name</th>
                                            <th className="p-4 font-medium text-neutral-400">Category</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800/50">
                                        {searchResults.map((r) => (
                                            <React.Fragment key={r.symbol}>
                                                <tr className="hover:bg-neutral-800/30 transition-colors">
                                                    <td className="p-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected(r.symbol)}
                                                            onChange={() => toggleSelection(r)}
                                                            className="w-4 h-4 rounded text-blue-600 bg-neutral-800 border-neutral-700 focus:ring-blue-600 focus:ring-offset-neutral-900"
                                                        />
                                                    </td>
                                                    <td className="p-4 font-bold">{r.symbol}</td>
                                                    <td className="p-4 text-neutral-400">{r.name}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${r.assetType === 'CRYPTO' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'
                                                            }`}>
                                                            {r.assetType}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right space-x-2">
                                                        {isTracked(r.symbol) ? (
                                                            <button
                                                                onClick={() => untrackMutation.mutate(r.symbol)}
                                                                className="text-amber-500 hover:text-amber-400 transition-colors tooltip"
                                                                title="Remove from Tracked Assets"
                                                            >
                                                                <Star className="w-5 h-5 fill-current" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => trackMutation.mutate(r)}
                                                                className="text-neutral-500 hover:text-amber-400 transition-colors tooltip"
                                                                title="Add to Tracked Assets"
                                                            >
                                                                <Star className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setShowPortfolioModalFor(r);
                                                                if (portfolios.length > 0 && !formPortfolioId) {
                                                                    setFormPortfolioId(portfolios[0].id);
                                                                }
                                                            }}
                                                            className="transition-colors tooltip text-neutral-500 hover:text-indigo-400"
                                                            title="Add to Portfolio"
                                                        >
                                                            <Briefcase className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Create Universe Panel */}
                    <div className="p-6 bg-blue-900/20 border border-blue-500/20 rounded-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <Layers className="w-5 h-5 text-blue-400" />
                            <h3 className="font-bold">Build Group Universe</h3>
                        </div>
                        <p className="text-sm text-neutral-400 mb-4">
                            Select multiple assets from the search results, give them a name, and save them as a Custom Universe group.
                        </p>

                        {selectedSymbols.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {selectedSymbols.map(s => (
                                        <span key={s.symbol} className="bg-neutral-800 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                                            {s.symbol} <X className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => toggleSelection(s)} />
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. FANG+ or Layer 1s"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 px-4 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    value={universeName}
                                    onChange={e => setUniverseName(e.target.value)}
                                />
                                <button
                                    onClick={() => createUniverseMutation.mutate()}
                                    disabled={createUniverseMutation.isPending || !universeName}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {createUniverseMutation.isPending ? 'Saving...' : `Save ${selectedSymbols.length} Assets`}
                                </button>
                            </div>
                        ) : (
                            <div className="text-center p-4 border border-dashed border-blue-500/30 rounded-xl text-neutral-500 text-sm">
                                Check boxes next to search results to build your group.
                            </div>
                        )}
                    </div>

                    {/* Tracked Assets List */}
                    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            Tracked Assets ({trackedAssets.length})
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {trackedAssets.length === 0 ? (
                                <p className="text-sm text-neutral-500 italic">No tracked assets yet.</p>
                            ) : (
                                trackedAssets.map((asset: any) => (
                                    <div key={asset.symbol} className="flex justify-between items-center group">
                                        <span className="text-sm font-medium">{asset.symbol}</span>
                                        <button
                                            onClick={() => untrackMutation.mutate(asset.symbol)}
                                            className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>



                    <div className="mt-8 pt-8 border-t border-neutral-800">
                        <div className="flex justify-between items-center mb-6"></div>
                    </div>

                    {/* Universes List */}
                    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <Layers className="w-4 h-4 text-purple-400" />
                            Custom Universes ({universes.length})
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {universes.length === 0 ? (
                                <p className="text-sm text-neutral-500 italic">No custom universes yet.</p>
                            ) : (
                                universes.map((u: any) => {
                                    const def = JSON.parse(u.definitionJson);
                                    return (
                                        <div key={u.id} className="flex flex-col gap-1 p-3 bg-neutral-950 rounded-xl group relative">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-sm text-blue-100">{u.name}</h4>
                                                <button
                                                    onClick={() => { if (confirm('Delete?')) deleteUniverseMutation.mutate(u.id); }}
                                                    className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all absolute right-2 top-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {Array.isArray(def.symbols) ? (
                                                    def.symbols.slice(0, 5).map((s: any) => (
                                                        <span key={s.symbol} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                                                            {s.symbol}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 truncate">
                                                        {def.q || 'Custom Query'}
                                                    </span>
                                                )}
                                                {Array.isArray(def.symbols) && def.symbols.length > 5 && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded text-neutral-500">+{def.symbols.length - 5} more</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add to Portfolio Modal */}
            {showPortfolioModalFor && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-neutral-800">
                            <h3 className="font-bold text-lg">Add Position</h3>
                            <button onClick={() => setShowPortfolioModalFor(null)} className="text-neutral-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form
                            className="p-6 space-y-4"
                            onSubmit={e => {
                                e.preventDefault();
                                if (!formPortfolioId) return;
                                addPortfolioMutation.mutate({
                                    portfolioId: formPortfolioId,
                                    symbol: showPortfolioModalFor.symbol,
                                    assetType: showPortfolioModalFor.assetType || 'STOCK',
                                    quantity: Number(formQty),
                                    averageCost: Number(formPrice),
                                    acquiredAt: formAcquiredAt ? new Date(formAcquiredAt).toISOString() : undefined,
                                    fees: formFees ? Number(formFees) : 0
                                });
                            }}
                        >
                            <div>
                                <label className="text-xs text-indigo-300 uppercase font-semibold mb-1 block">Symbol</label>
                                <input
                                    type="text" disabled
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white focus:outline-none opacity-50 cursor-not-allowed"
                                    value={showPortfolioModalFor.symbol}
                                />
                            </div>

                            <div>
                                <label className="text-xs text-indigo-300 uppercase font-semibold mb-1 block">Select Portfolio</label>
                                <select
                                    required
                                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
                                    value={formPortfolioId}
                                    onChange={e => setFormPortfolioId(e.target.value)}
                                >
                                    <option value="" disabled>Choose a portfolio...</option>
                                    {portfolios.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.baseCurrency})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-neutral-400 uppercase font-semibold mb-1 block">Quantity</label>
                                    <input
                                        type="number" step="any" min="0" required
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
                                        value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-neutral-400 uppercase font-semibold mb-1 block">Avg Cost</label>
                                    <input
                                        type="number" step="any" min="0" required
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
                                        value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-neutral-400 uppercase font-semibold mb-1 block">Acquisition Date (Opt)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                                        value={formAcquiredAt} onChange={e => setFormAcquiredAt(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-neutral-400 uppercase font-semibold mb-1 block">Fees (Opt)</label>
                                    <input
                                        type="number" step="any" min="0"
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
                                        value={formFees} onChange={e => setFormFees(e.target.value)} placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="mt-6">
                                <button
                                    type="submit"
                                    disabled={addPortfolioMutation.isPending}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-3 transition-colors flex items-center justify-center disabled:opacity-50"
                                >
                                    {addPortfolioMutation.isPending ? 'Adding Position...' : 'Add Position'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
