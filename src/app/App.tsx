import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CardsPage } from "./pages/CardsPage";
import { CardDetailPage } from "./pages/CardDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OffersPage } from "./pages/OffersPage";
import { RunsPage } from "./pages/RunsPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate replace to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/anuncios" element={<OffersPage />} />
          <Route path="/new-offers" element={<Navigate replace to="/offers" />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:id" element={<CardDetailPage />} />
          <Route path="/runs" element={<RunsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
