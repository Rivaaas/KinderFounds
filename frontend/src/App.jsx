import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRouter from './routes/AppRouter';
import ServerWakingNotice from './components/UI/ServerWakingNotice';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
        <ServerWakingNotice />
      </AuthProvider>
    </ThemeProvider>
  );
}
