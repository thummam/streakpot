import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Avatar } from './components/Avatar';
import { AuthPage } from './pages/AuthPage';
import { ChallengePage } from './pages/ChallengePage';
import { Dashboard } from './pages/Dashboard';
import { JoinPage } from './pages/JoinPage';
import { Landing } from './pages/Landing';
import { NewChallenge } from './pages/NewChallenge';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

export default function App() {
  const { user, loading, logout } = useAuth();

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          StreakPot
        </Link>
        <nav>
          {user ? (
            <>
              <Link to="/new" className="btn btn-small hide-sm">
                + New challenge
              </Link>
              <span className="who" title={user.email}>
                <Avatar name={user.name} size={30} />
              </span>
              <button className="link" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            !loading && (
              <>
                <Link to="/login" className="link">
                  Log in
                </Link>
                <Link to="/signup" className="btn btn-small">
                  Sign up
                </Link>
              </>
            )
          )}
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={loading ? null : user ? <Dashboard /> : <Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/new" element={<RequireAuth><NewChallenge /></RequireAuth>} />
          <Route path="/c/:id" element={<RequireAuth><ChallengePage /></RequireAuth>} />
          <Route path="*" element={<div className="center"><h2>Page not found</h2><Link to="/">Go home</Link></div>} />
        </Routes>
      </main>
    </>
  );
}
