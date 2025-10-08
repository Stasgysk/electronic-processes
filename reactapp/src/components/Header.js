import './Header.css'
import LoginButton from "./LoginButton";
import {useUser} from "../contexts/UserContext";

export default function Header() {
    const { user } = useUser();
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
            </nav>
        </header>
    )
}