import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:roomCode" element={<RoomPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
