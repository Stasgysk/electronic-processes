import './Header.css'
import LoginButton from "./LoginButton";
import {useUser} from "../contexts/UserContext";
import {useTranslation} from "react-i18next";
import {Button, ButtonGroup, ToggleButton} from "react-bootstrap";
import {useState} from "react";

export default function Header() {
    const { i18n } = useTranslation();
    const { user } = useUser();
    const [radioValue, setRadioValue] = useState('1');

    const radios = [
        { name: 'EN', value: '2', languageCode: 'en' },
        { name: 'SK', value: '1', languageCode: 'sk' },
    ];

    return (
        <header className="App-header">
            <div className="user-info">
                {user ? (
                    <>
                        <h2>{user.name}</h2>
                        <p>{user.email}</p>
                    </>
                ) : null}
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
                            onClick={() => i18n.changeLanguage(radio.languageCode)}
                        >
                            {radio.name}
                        </ToggleButton>
                    ))}
                </ButtonGroup>
            </nav>
        </header>
    )
}