import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import './LandingPage.css';

export default function LandingPage() {
    const { redirectToSSO } = useAuth();
    const { t } = useTranslation();

    return (
        <div className="landing">
            <div className="landing-card">
                <div className="landing-logo">📋</div>

                <span className="landing-badge">TUKE</span>

                <h1 className="landing-title">
                    Electronic<br /><span>Processes</span>
                </h1>

                <p className="landing-subtitle">
                    {t('landingSubtitle') || 'Systém pre elektronické spracovanie procesov a formulárov na Technickej univerzite v Košiciach.'}
                </p>

                <button className="landing-login-btn" onClick={redirectToSSO}>
                    <span className="landing-login-icon">🔐</span>
                    {t('loginWithSSO') || t('login')}
                </button>

                <p className="landing-footer">
                    {t('landingFooter')}
                </p>
            </div>
        </div>
    );
}
