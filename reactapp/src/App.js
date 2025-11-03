import { useState } from "react";
import "./App.css";
import "./i18n";
import Header from "./components/Header";
import { AuthProvider } from "./contexts/AuthContext";
import { UserProvider, useUser } from "./contexts/UserContext";
import GroupSelector from "./components/GroupSelector";
import AvailableForms from "./components/AvailableForms";
import Forms from "./components/Forms";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getAvailableForms, getAwaitingForms } from "./api/forms.service";
import {useFormsLoader} from "./hooks/useFormsLoader";

function AppContent() {
    const { t } = useTranslation();
    const { user, loading, error, updateUser } = useUser();
    const [openSection, setOpenSection] = useState({
        available: true,
        second: false,
    });

    const {
        forms: availableForms,
        loaded: availableFormsLoaded,
        loadingError: availableFormsLoadingError,
    } = useFormsLoader(user, getAvailableForms, t);

    // ✅ Загрузка ожидающих форм через тот же хук
    // const {
    //     forms: awaitingForms,
    //     loaded: awaitingFormsLoaded,
    //     loadingError: awaitingFormsLoadingError,
    // } = useFormsLoader(user, getAwaitingForms, t);

    const toggleSection = (section) => {
        setOpenSection((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error: {error.message}</p>;

    const updateCurrentUser = (user) => updateUser(user);

    return (
        <>
            {user && user?.userGroupId === 0 && (
                <GroupSelector user={user} updateUser={updateCurrentUser} />
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
                                            {/*<AwaitingForms*/}
                                            {/*    forms={awaitingForms}*/}
                                            {/*    loading={!awaitingFormsLoaded}*/}
                                            {/*    error={awaitingFormsLoadingError}*/}
                                            {/*/>*/}
                                        </div>
                                    )}
                                </div>
                            </>
                        }
                    />
                    <Route path="/form/:id" element={<Forms />} />
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