import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Login_page from "./components/pages/login_page";
import Not_found_page from "./components/pages/not_found_page";
import ProtectedRoute from "./components/custom_ui/protected_route";
import RouteFallback from "./components/custom_ui/route_fallback";

// Login is the entry point and stays in the main bundle; the two consoles
// are split so an operator terminal never downloads the admin screens
// (calendar, tables, settings forms) and vice-versa.
const Admin_page = lazy(() => import("./components/pages/admin_page"));
const Operator_page = lazy(() => import("./components/pages/operator_page"));

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login_page />} />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="admin">
              <Admin_page />
            </ProtectedRoute>
          }
        />

        <Route
          path="/operator"
          element={
            <ProtectedRoute>
              <Operator_page />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Not_found_page />} />
      </Routes>
    </Suspense>
  );
}

export default App;
