import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import DetailPage from "./pages/DetailPage";
import TagsPage from "./pages/TagsPage";
import TagFilterPage from "./pages/TagFilterPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/bookmark/:id" element={<DetailPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/tags/:tagName" element={<TagFilterPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
