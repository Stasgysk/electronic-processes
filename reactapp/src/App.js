// Root of the React application.
//
// Provider structure (outermost first):
//   Router → AuthProvider → UserProvider → AppContent
//
// AuthProvider handles the TUKE SSO login flow and stores the JWT access token.
// UserProvider fetches the /me profile once the token is available.
// AppContent reads both and decides what to render.

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

// AppContent is a separate component so it can call useLocation(), which requires
// being inside the Router — App() itself wraps the Router so it can't call it directly
function AppContent() {
    const location = useLocation();
    const { t } = useTranslation();
    const { authLoading } = useAuth();
    const { user, loading, error, updateUser } = useUser();

    // which of the three home-page tabs is currently active
    const [activeHomeTab, setActiveHomeTab] = useState('available');

    // bumping this integer causes all three useFormsLoader hooks to re-fetch their lists;
    // FormsPage calls navigate("/", { state: { refresh: true } }) after a successful submission
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (location.state?.refresh) {
            setRefreshKey(prev => prev + 1);
        }
    }, [location.state]);

    // each list has its own loading/error/data state, managed by the shared useFormsLoader hook
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

    // wait for both auth check and user fetch before rendering anything — avoids a flash of wrong state
    if (authLoading || loading) return null;
    if (error) return <p>Error: {error.message}</p>;

    const updateCurrentUser = (user) => updateUser(user);

    // unauthenticated: show only the landing page regardless of the URL
    if (!user) {
        return (
            <Routes>
                <Route path="*" element={<LandingPage />} />
            </Routes>
        );
    }

    return (
        <>
            {/*
              Onboarding modal fires when:
                - userGroupId === 0  →  brand new user who hasn't selected their group yet
                - STUDENT group but no orgUnitId  →  student hasn't picked their year/faculty
              The modal blocks the rest of the UI until the user completes setup.
            */}
            {user && (user.userGroupId === 0 || (user.UsersGroups?.name === 'STUDENT' && !user.orgUnitId)) && (
                <OnboardingModal user={user} updateUser={updateCurrentUser} />
            )}
            <Header />
            <main className="App-main">
                <Routes>
                    <Route path="/" element={
                            <div className="home-page">
                                {/* tab bar — "Awaiting" shows a badge with the count of pending approvals */}
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

                                {/*
                                  key={activeHomeTab} remounts the panel when the tab changes,
                                  which resets any internal scroll position inside the list
                                */}
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
                    {/* /form/:id handles all form views — see FormsPage for the type= param logic */}
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
