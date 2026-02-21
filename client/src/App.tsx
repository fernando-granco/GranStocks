import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Screener from './pages/Screener';
import AssetDetail from './pages/AssetDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import './index.css';

const queryClient = new QueryClient();

// Thin wrapper to pass route params and navigate to the extracted AssetDetail component
function AssetDetailWrapper() {
    const { assetType, symbol } = useParams();
    const navigate = useNavigate();
    if (!symbol || !assetType) return null;
    return <AssetDetail symbol={symbol.toUpperCase()} assetType={assetType.toUpperCase() as 'STOCK' | 'CRYPTO'} onBack={() => navigate('/app')} />;
}

// Thin wrapper for Dashboard to handle navigation
function DashboardWrapper() {
    const navigate = useNavigate();
    return <Dashboard onSelect={(symbol, assetType) => navigate(`/app/asset/${assetType.toLowerCase()}/${symbol.toLowerCase()}`)} />;
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        <Route path="/app" element={<ProtectedRoute />}>
                            <Route element={<Layout />}>
                                <Route index element={<DashboardWrapper />} />
                                <Route path="screener" element={<Screener />} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="asset/:assetType/:symbol" element={<AssetDetailWrapper />} />
                            </Route>
                        </Route>
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
}
