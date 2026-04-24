import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import CalendarPage from "@/pages/CalendarPage";
import ArtistsPage from "@/pages/ArtistsPage";
import VenuesPage from "@/pages/VenuesPage";
import PublicCalendar from "@/pages/PublicCalendar";

function Chrome({ children }) {
  const location = useLocation();
  // Public shared view bypasses the admin layout
  if (location.pathname.startsWith("/public/")) return children;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <Chrome>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calendrier" element={<CalendarPage />} />
            <Route path="/artistes" element={<ArtistsPage />} />
            <Route path="/lieux" element={<VenuesPage />} />
            <Route path="/public/:token" element={<PublicCalendar />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Chrome>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#121215",
            border: "1px solid #27272A",
            borderRadius: 0,
            color: "#fff",
            fontFamily: "'IBM Plex Sans', sans-serif",
          },
        }}
      />
    </div>
  );
}

export default App;
