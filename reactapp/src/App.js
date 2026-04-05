import {useEffect, useState} from "react";
import "./App.css";
import "./i18n";
import Header from "./components/Header";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { UserProvider, useUser } from "./contexts/UserContext";
import OnboardingModal from "./components/OnboardingModal";
import AvailableForms from "./components/AvailableForms";
import {BrowserRouter as Router, Routes, Route, useLocation} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getAvailableForms } from "./api/forms.service";
import {useFormsLoader} from "./hooks/useFormsLoader";
import AwaitingForms from "./components/AwaitingForms";
import FilledForms from "./components/FilledForms";
import {getAwaitingForms} from "./api/formsInstances.service";
import {getFilledProcessesAndFormsInstances} from "./api/processesInstances.service";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import FormsPage from "./pages/FormsPage";
import LandingPage from "./pages/LandingPage";

function AppContent() {
    const location = useLocation();
    const { t } = useTranslation();
    const { authLoading } = useAuth();
    const { user, loading, error, updateUser } = useUser();
    const [activeHomeTab, setActiveHomeTab] = useState('available');

    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (location.state?.refresh) {
            setRefreshKey(prev => prev + 1);
        }
    }, [location.state]);

    const {
        forms: availableForms,
        loaded: availableFormsLoaded,
        loadingError: availableFormsLoadingError,
    } = useFormsLoader(user, getAvailableForms, t, refreshKey);

    const {
        forms: awaitingForms,
        loaded: awaitingFormsLoaded,
        loadingError: awaitingFormsLoadingError,
    } = useFormsLoader(user, getAwaitingForms, t, refreshKey);

    const {
        forms: filledForms,
        loaded: filledFormsLoaded,
        loadingError: filledFormsLoadingError,
    } = useFormsLoader(user, getFilledProcessesAndFormsInstances, t, refreshKey);

    if (authLoading || loading) return null;
    if (error) return <p>Error: {error.message}</p>;

    const updateCurrentUser = (user) => updateUser(user);

    if (!user) {
        return (
            <Routes>
                <Route path="*" element={<LandingPage />} />
            </Routes>
        );
    }

    return (
        <>
            {user && (user.userGroupId === 0 || (user.UsersGroups?.name === 'STUDENT' && !user.orgUnitId)) && (
                <OnboardingModal user={user} updateUser={updateCurrentUser} />
            )}
            <Header />
            <main className="App-main">
                <Routes>
                    <Route path="/" element={
                            <div className="home-page">
                                <nav className="home-tabs">
                                    <button className={`home-tab${activeHomeTab === 'available' ? ' active' : ''}`} onClick={() => setActiveHomeTab('available')}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                        {t('availableForms')}
                                    </button>
                                    <button className={`home-tab${activeHomeTab === 'awaiting' ? ' active' : ''}`} onClick={() => setActiveHomeTab('awaiting')}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                        {t('formsAwaitingActions')}
                                        {awaitingForms.length > 0 && <span className="home-tab-badge">{awaitingForms.length}</span>}
                                    </button>
                                    <button className={`home-tab${activeHomeTab === 'filled' ? ' active' : ''}`} onClick={() => setActiveHomeTab('filled')}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        {t('filledForms')}
                                    </button>
                                </nav>

                                <div className="home-tab-content" key={activeHomeTab}>
                                    {activeHomeTab === 'available' && (
                                        <AvailableForms forms={availableForms} loading={!availableFormsLoaded} error={availableFormsLoadingError} />
                                    )}
                                    {activeHomeTab === 'awaiting' && (
                                        <AwaitingForms forms={awaitingForms} loading={!awaitingFormsLoaded} error={awaitingFormsLoadingError} />
                                    )}
                                    {activeHomeTab === 'filled' && (
                                        <FilledForms forms={filledForms} loading={!filledFormsLoaded} error={filledFormsLoadingError} />
                                    )}
                                </div>
                            </div>
                        }
                    />
                    <Route path="/form/:id" element={<FormsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/admin" element={<AdminPage />} />
                </Routes>
            </main>
        </>
    );
}

export default function App() {
    return (
        <Router basename="/">
            <AuthProvider>
                <UserProvider>
                        <div className="App">
                            <AppContent />
                        </div>
                </UserProvider>
            </AuthProvider>
        </Router>
    );
}
