// Shown to unauthenticated users — the only page without the Header.
//
// Split layout: left branding panel, right login card.
// The single login action is redirectToSSO() from AuthContext, which sends
// the user to the TUKE SSO2 identity provider.  There is no local
// username/password login.
//
// The language toggle here duplicates the one in Header because the Header
// is not rendered on this page.  Chosen language is persisted in localStorage.

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import './LandingPage.css';

export default function LandingPage() {
    const { redirectToSSO } = useAuth();
    const { t, i18n } = useTranslation();
    const [lang, setLang] = useState(i18n.language?.startsWith('en') ? 'en' : 'sk');

    const switchLang = (code) => {
        setLang(code);
        i18n.changeLanguage(code);
        localStorage.setItem('lang', code);
    };

    return (
        <div className="landing">
            {/* Left: branding panel */}
            <div className="landing-left">
                <p className="landing-eyebrow">TUKE — KPI</p>
                <h1 className="landing-left-title">
                    Electronic<br /><span>Processes</span>
                </h1>
                <p className="landing-left-desc">{t('landingSubtitle')}</p>
            </div>

            {/* Right: login panel */}
            <div className="landing-right">
                <div className="landing-card">
                    <div className="landing-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>

                    <h2 className="landing-card-title">{t('login')}</h2>
                    <p className="landing-card-sub">{t('landingFooter')}</p>

                    <div className="landing-actions">
                        <button className="landing-login-btn" onClick={redirectToSSO}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            {t('loginWithSSO')}
                        </button>

                        <div className="landing-lang">
                            <button className={`landing-lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => switchLang('en')}>EN</button>
                            <button className={`landing-lang-btn${lang === 'sk' ? ' active' : ''}`} onClick={() => switchLang('sk')}>SK</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
