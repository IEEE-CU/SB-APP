import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { router } from "./routes";
import { useThemeStore } from "@/store/themeStore";
import "./index.css";

// Initialize dark mode before mounting
useThemeStore.getState().initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
    <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
  </React.StrictMode>,
);
