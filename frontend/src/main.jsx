import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./app/App";
import { ToastProvider } from "./components/ui";
import { AuthProvider } from "./contexts/AuthContext";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename="/imigrasi">
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
