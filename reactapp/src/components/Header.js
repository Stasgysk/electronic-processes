import './Header.css'
import LoginButton from "./LoginButton";
import {useUser} from "../contexts/UserContext";
import {useTranslation} from "react-i18next";
import {ButtonGroup, ToggleButton} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {useState} from "react";

export default function Header() {
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const navigate = useNavigate();
    const [radioValue, setRadioValue] = useState('1');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const isStaff = user && user.UsersGroups?.name === 'ADMIN';

    const radios = [
        { name: 'EN', value: '2', languageCode: 'en' },
        { name: 'SK', value: '1', languageCode: 'sk' },
    ];

    const handleNavigate = (path) => {
        navigate(path);
        setDrawerOpen(false);
    };

    return (
        <>
            <header className="App-header">
                <button
                    className="hamburger-btn"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open menu"
                >
                    <span /><span /><span />
                </button>

                <div className="header-left">
                    {user && (
                        <button className="header-nav-btn" onClick={() => navigate('/')}>
                            {t('home')}
                        </button>
                    )}
                    {user && (
                        <button className="header-nav-btn" onClick={() => navigate('/profile')}>
                            {t('profileText')}
                        </button>
                    )}
                    {isStaff && (
                        <button className="header-nav-btn" onClick={() => navigate('/admin')}>
                            {t('admin')}
                        </button>
                    )}
                </div>

                <nav className="nav-links">
                    <LoginButton />
                    <ButtonGroup className="language-button-group">
                        {radios.map((radio, idx) => (
                            <ToggleButton
                                key={idx}
                                id={`radio-${idx}`}
                                type="radio"
                                variant="outline-light"
                                name="radio"
                                value={radio.value}
                                checked={radioValue === radio.value}
                                size="sm"
                                onChange={(e) => setRadioValue(e.currentTarget.value)}
                                onClick={() => { i18n.changeLanguage(radio.languageCode); localStorage.setItem('lang', radio.languageCode); }}
                            >
                                {radio.name}
                            </ToggleButton>
                        ))}
                    </ButtonGroup>
                </nav>
            </header>

            {drawerOpen && (
                <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
            )}

            <div className={`mobile-drawer${drawerOpen ? ' open' : ''}`}>
                <div className="drawer-header">
                    <span className="drawer-title">Menu</span>
                    <button className="drawer-close-btn" onClick={() => setDrawerOpen(false)}>×</button>
                </div>

                <nav className="drawer-nav">
                    {user && (
                        <button className="drawer-nav-btn" onClick={() => handleNavigate('/')}>
                            {t('home')}
                        </button>
                    )}
                    {user && (
                        <button className="drawer-nav-btn" onClick={() => handleNavigate('/profile')}>
                            {t('profileText')}
                        </button>
                    )}
                    {isStaff && (
                        <button className="drawer-nav-btn" onClick={() => handleNavigate('/admin')}>
                            {t('admin')}
                        </button>
                    )}
                </nav>

                <div className="drawer-section-title">{t('language') || 'Jazyk / Language'}</div>
                <div className="drawer-lang">
                    {radios.map((radio, idx) => (
                        <button
                            key={idx}
                            className={`drawer-lang-btn${radioValue === radio.value ? ' active' : ''}`}
                            onClick={() => {
                                setRadioValue(radio.value);
                                i18n.changeLanguage(radio.languageCode);
                                localStorage.setItem('lang', radio.languageCode);
                            }}
                        >
                            {radio.name}
                        </button>
                    ))}
                </div>

                <div className="drawer-login">
                    <LoginButton />
                </div>
            </div>
        </>
    );
}
