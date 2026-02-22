import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Globe } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

export default function Settings() {
    const [configName, setConfigName] = useState('');
    const [configProvider, setConfigProvider] = useState('OPENAI');
    const [configApiKey, setConfigApiKey] = useState('');
    const [configModel, setConfigModel] = useState('');
    const [configBaseUrl, setConfigBaseUrl] = useState('');
    const { timezone, setTimezone } = usePreferences();
    const queryClient = useQueryClient();

    // LLM Configs Query
    const { data: configs } = useQuery({
        queryKey: ['llmConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/llm');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const addConfigMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/settings/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: configName,
                    provider: configProvider,
                    apiKey: configApiKey,
                    model: configModel,
                    baseUrl: configBaseUrl || undefined
                })
            });
            if (!res.ok) throw new Error('Failed to save config');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['llmConfigs'] });
            setConfigName(''); setConfigApiKey(''); setConfigModel(''); setConfigBaseUrl('');
        }
    });

    const deleteConfigMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/settings/llm/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete config');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['llmConfigs'] });
        }
    });
    return (
        <div className="max-w-2xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold mb-6">Settings</h1>
            </div>

            <div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold mb-2">BYOK AI Providers</h3>
                    <p className="text-neutral-500 text-sm mb-6">Securely add your API keys. Keys are AES-256-GCM encrypted on the server. The frontend never sees them.</p>

                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); addConfigMutation.mutate(); }}>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="Config Name (e.g. My ChatGPT)" value={configName} onChange={e => setConfigName(e.target.value)} required className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                            <select value={configProvider} onChange={e => setConfigProvider(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500">
                                <option value="OPENAI">OpenAI</option>
                                <option value="ANTHROPIC">Anthropic</option>
                                <option value="GEMINI">Google Gemini</option>
                                <option value="XAI">xAI (Grok)</option>
                                <option value="DEEPSEEK">DeepSeek</option>
                                <option value="GROQ">Groq</option>
                                <option value="TOGETHER">Together AI</option>
                                <option value="OPENAI_COMPAT">OpenAI Compatible (v1)</option>
                            </select>
                        </div>
                        {configProvider === 'OPENAI_COMPAT' && (
                            <p className="text-xs text-indigo-400 mt-1">
                                Use this to connect to any other API that uses the OpenAI format (e.g., LM Studio, vLLM, custom clusters). Provide your custom endpoint in the "Base URL" field.
                            </p>
                        )}
                        <input type="password" placeholder="API Key" value={configApiKey} onChange={e => setConfigApiKey(e.target.value)} required className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                        <div className="grid grid-cols-2 gap-4">
                            <input list="model-options" type="text" placeholder={configProvider === 'ANTHROPIC' ? 'claude-3-5-sonnet-20241022' : configProvider === 'DEEPSEEK' ? 'deepseek-chat' : configProvider === 'GROQ' ? 'llama3-70b-8192' : configProvider === 'GEMINI' ? 'gemini-1.5-flash' : configProvider === 'XAI' ? 'grok-beta' : 'Model Name (e.g. gpt-4o)'} value={configModel} onChange={e => setConfigModel(e.target.value)} required className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                            <datalist id="model-options">
                                {configProvider === 'OPENAI' && <><option value="gpt-4o" /><option value="gpt-4o-mini" /><option value="o1-preview" /></>}
                                {configProvider === 'ANTHROPIC' && <><option value="claude-3-5-sonnet-20241022" /><option value="claude-3-5-haiku-20241022" /><option value="claude-3-opus-20240229" /></>}
                                {configProvider === 'GEMINI' && <><option value="gemini-1.5-flash" /><option value="gemini-1.5-pro" /><option value="gemini-2.0-flash-exp" /></>}
                                {configProvider === 'XAI' && <><option value="grok-beta" /><option value="grok-vision-beta" /><option value="grok-2" /></>}
                                {configProvider === 'DEEPSEEK' && <><option value="deepseek-chat" /><option value="deepseek-reasoner" /></>}
                                {configProvider === 'GROQ' && <><option value="llama3-70b-8192" /><option value="llama3-8b-8192" /><option value="mixtral-8x7b-32768" /></>}
                                {configProvider === 'TOGETHER' && <><option value="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" /><option value="mistralai/Mixtral-8x7B-Instruct-v0.1" /></>}
                            </datalist>
                            <input type="text" placeholder="Base URL (Optional)" value={configBaseUrl} onChange={e => setConfigBaseUrl(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500" />
                        </div>

                        <button type="submit" disabled={addConfigMutation.isPending} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium text-white rounded-lg w-full transition-colors mt-2">
                            {addConfigMutation.isPending ? 'Saving...' : 'Save Provider'}
                        </button>
                    </form>

                    <div className="mt-8 space-y-2">
                        {configs?.map((cfg: any) => (
                            <div key={cfg.id} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3">
                                <div>
                                    <div className="font-medium text-white">{cfg.name} <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded ml-2">{cfg.provider}</span></div>
                                    <div className="text-xs text-neutral-500 mt-1">Model: {cfg.model} | Key: ****{cfg.keyLast4}</div>
                                </div>
                                <button
                                    onClick={() => deleteConfigMutation.mutate(cfg.id)}
                                    disabled={deleteConfigMutation.isPending}
                                    className="text-neutral-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                                    title="Delete this provider"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><Globe size={20} className="text-indigo-400" /> General Settings</h3>
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-2">Display Timezone</label>
                    <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                        <optgroup label="North America">
                            <option value="America/Toronto">Eastern Time — Toronto / New York</option>
                            <option value="America/Chicago">Central Time — Chicago</option>
                            <option value="America/Denver">Mountain Time — Denver</option>
                            <option value="America/Los_Angeles">Pacific Time — Los Angeles / Vancouver</option>
                            <option value="America/Anchorage">Alaska Time — Anchorage</option>
                            <option value="Pacific/Honolulu">Hawaii — Honolulu</option>
                            <option value="America/Mexico_City">Mexico City</option>
                            <option value="America/Sao_Paulo">São Paulo</option>
                            <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
                        </optgroup>
                        <optgroup label="Europe">
                            <option value="UTC">UTC</option>
                            <option value="Europe/London">London (GMT/BST)</option>
                            <option value="Europe/Paris">Paris / Berlin / Madrid / Rome (CET)</option>
                            <option value="Europe/Helsinki">Helsinki / Kyiv (EET)</option>
                            <option value="Europe/Moscow">Moscow</option>
                            <option value="Europe/Istanbul">Istanbul</option>
                        </optgroup>
                        <optgroup label="Asia / Pacific">
                            <option value="Asia/Dubai">Dubai (GST)</option>
                            <option value="Asia/Karachi">Karachi (PKT)</option>
                            <option value="Asia/Kolkata">Mumbai / Kolkata (IST)</option>
                            <option value="Asia/Dhaka">Dhaka (BST)</option>
                            <option value="Asia/Bangkok">Bangkok / Jakarta (ICT)</option>
                            <option value="Asia/Singapore">Singapore / Hong Kong / Kuala Lumpur</option>
                            <option value="Asia/Shanghai">Beijing / Shanghai (CST)</option>
                            <option value="Asia/Tokyo">Tokyo (JST)</option>
                            <option value="Australia/Sydney">Sydney (AEST)</option>
                            <option value="Pacific/Auckland">Auckland (NZST)</option>
                        </optgroup>
                        <optgroup label="Africa">
                            <option value="Africa/Lagos">Lagos / Nairobi (WAT)</option>
                            <option value="Africa/Nairobi">Nairobi (EAT)</option>
                            <option value="Africa/Johannesburg">Johannesburg (SAST)</option>
                            <option value="Africa/Cairo">Cairo (EET)</option>
                        </optgroup>
                    </select>
                    <p className="text-xs text-neutral-500 mt-2">Affects chart timestamps and daily job scheduling display.</p>
                </div>
            </div>

        </div>
    );
}
