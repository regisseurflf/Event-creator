import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import CalendarPage from "@/pages/CalendarPage";

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calendrier" element={<CalendarPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
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
