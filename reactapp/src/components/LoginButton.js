// Small button that toggles between Login and Logout depending on whether
// the user currently has a valid access token.
//
// Login → calls redirectToSSO() which sends the browser to the TUKE SSO page.
// Logout → calls logoutUser() which clears tokens and redirects to the landing page.

import React from "react";
import { useAuth } from "../contexts/AuthContext";
import {Button} from "react-bootstrap";
import {useTranslation} from "react-i18next";

export default function LoginButton() {
    const { accessToken, redirectToSSO, logoutUser } = useAuth();
    const { t } = useTranslation();

    return (
        <div>
            {!accessToken ? (
                <Button variant="light" type="submit" onClick={redirectToSSO} >{t('login')}</Button>
            ) : (
                <Button variant="light" type="submit" onClick={logoutUser} >{t('logout')}</Button>
            )}
        </div>
    );
}
