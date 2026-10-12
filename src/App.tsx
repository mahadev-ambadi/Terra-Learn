import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/ThemeProvider";
import { I18nProvider } from "./lib/i18n/I18nProvider";
import { BrandSplash } from "./components/BrandSplash";
import { Landing } from "../hero/src/landing/Landing";

// the signed-in app (auth, dashboard, maps, charts) is split out so the landing page loads only
// what it draws
const AppShell = lazy(() => import("./AppShell"));

function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Toaster position="top-right" richColors theme="system" />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="*"
            element={
              <Suspense fallback={<BrandSplash />}>
                <AppShell />
              </Suspense>
            }
          />
        </Routes>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
