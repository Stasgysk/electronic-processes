import {useEffect, useState} from "react";
import "./App.css";
import "./i18n";
import Header from "./components/Header";
import { AuthProvider } from "./contexts/AuthContext";
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
    const { user, loading, error, updateUser } = useUser();
    const [openSection, setOpenSection] = useState({
        available: true,
        second: true,
        filled: false,
    });

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

    const toggleSection = (section) => {
        setOpenSection((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    if (loading) return <p style={{ padding: '2rem', textAlign: 'center' }}>{t('loading')}...</p>;
    if (error) return <p>Error: {error.message}</p>;

    const updateCurrentUser = (user) => updateUser(user);

    if (!user) {
        return (
            <>
                <Header />
                <Routes>
                    <Route path="*" element={<LandingPage />} />
                </Routes>
            </>
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
                            <>
                                <div className="main-section">
                                    <h2
                                        className="section-header"
                                        onClick={() => toggleSection("available")}
                                    >
                                        {t("availableForms")}
                                        <span className="arrow">
                                            {openSection.available ? "▲" : "▼"}
                                        </span>
                                    </h2>
                                    {openSection.available && (
                                        <div className="table-wrapper">
                                            <AvailableForms
                                                forms={availableForms}
                                                loading={!availableFormsLoaded}
                                                error={availableFormsLoadingError}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="main-section">
                                    <h2
                                        className="section-header"
                                        onClick={() => toggleSection("second")}
                                    >
                                        {t("formsAwaitingActions")}
                                        <span className="arrow">
                                            {openSection.second ? "▲" : "▼"}
                                        </span>
                                    </h2>
                                    {openSection.second && (
                                        <div className="table-wrapper">
                                            <AwaitingForms
                                                forms={awaitingForms}
                                                loading={!awaitingFormsLoaded}
                                                error={awaitingFormsLoadingError}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="main-section">
                                    <h2
                                        className="section-header"
                                        onClick={() => toggleSection("filled")}
                                    >
                                        {t("filledForms")}
                                        <span className="arrow">
                                            {openSection.filled ? "▲" : "▼"}
                                        </span>
                                    </h2>
                                    {openSection.filled && (
                                        <div className="table-wrapper">
                                            <FilledForms
                                                forms={filledForms}
                                                loading={!filledFormsLoaded}
                                                error={filledFormsLoadingError}
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
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
