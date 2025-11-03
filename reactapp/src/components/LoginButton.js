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
