import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../utils';
import { Star, GripVertical } from 'lucide-react';

export function SortableCard({ item, onClick, onUntrack }: { item: any; onClick: () => void; onUntrack: (symbol: string) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.symbol });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            className={cn(
                "group p-6 rounded-2xl bg-neutral-900 border transition-all cursor-pointer relative overflow-hidden flex flex-col h-full",
                isDragging ? "border-indigo-500 shadow-2xl shadow-indigo-500/20 opacity-90 scale-105" : "border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800/80"
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab text-neutral-600 hover:text-white p-1 -ml-2 active:cursor-grabbing transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical size={18} />
                    </div>
                    <h1 className="text-2xl font-bold">{item.symbol}</h1>
                </div>
                <div className="flex items-center gap-2">
                    {item.prediction?.[0] && (
                        <span className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-full",
                            item.prediction[0].predictedReturnPct > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                            {item.prediction[0].predictedReturnPct > 0 ? 'Bullish' : 'Bearish'} Bias
                        </span>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onUntrack(item.symbol); }}
                        className="text-amber-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all tooltip z-10 p-1"
                        title="Untrack Asset"
                    >
                        <Star size={16} className="fill-current" />
                    </button>
                </div>
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
                <div className="text-sm text-neutral-500 mt-4">Awaiting chron job...</div>
            )}
        </div>
    );
}
