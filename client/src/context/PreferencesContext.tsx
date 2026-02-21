import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface PreferencesContextType {
    mode: 'ADVANCED';
    timezone: string;
    setTimezone: (tz: string) => Promise<void>;
    isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType>({
    mode: 'ADVANCED',
    timezone: 'America/Toronto',
    setTimezone: async () => { },
    isLoading: true
});

export const usePreferences = () => useContext(PreferencesContext);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [timezone, setTimezoneState] = useState<string>('America/Toronto');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        fetch('/api/settings/preferences')
            .then(res => res.json())
            .then(data => {
                if (data.timezone) setTimezoneState(data.timezone);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [user]);

    const setTimezone = async (newTz: string) => {
        setTimezoneState(newTz);
        try {
            const res = await fetch('/api/settings/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timezone: newTz })
            });
            if (!res.ok) throw new Error('Failed to update timezone');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <PreferencesContext.Provider value={{ mode: 'ADVANCED', timezone, setTimezone, isLoading }}>
            {children}
        </PreferencesContext.Provider>
    );
};
