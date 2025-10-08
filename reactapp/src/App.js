import './App.css';
import Header from "./components/Header";
import { AuthProvider } from "./contexts/AuthContext";
import {UserProvider, useUser} from "./contexts/UserContext";
import GroupSelector from "./components/GroupSelector";

function AppContent() {
    const { user, loading, error, updateUser } = useUser();

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error: {error.message}</p>;

    const updateCurrentUser = (user) => {
        console.log(user);
        updateUser(user);
    }

    return (
        <>
            {user && user?.userGroupId === 0 && <GroupSelector user = {user} updateUser = {updateCurrentUser} />}
            <Header />
            <main className="App-main">
            </main>
        </>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <UserProvider>
                <div className="App">
                    <AppContent />
                </div>
            </UserProvider>
        </AuthProvider>
    );
}
