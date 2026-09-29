import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth-context";

/**
 * Gate for authenticated areas. Before this existed, typing /admin in the
 * address bar handed anyone the full settings panel.
 *
 * The session is restored synchronously from localStorage, so there is no
 * loading window to guard — a refresh on /admin stays on /admin.
 */
export default function ProtectedRoute({
  role,
  children,
}: {
  role?: "admin" | "operator";
  children: ReactNode;
}) {
  // The auth context is authored in JSX; declare its shape at this boundary.
  const { user, homeFor } = useAuth() as {
    user: { role: string } | null;
    homeFor: (role?: string) => string;
  };
  const location = useLocation();

  if (!user) {
    // `from` lets the login screen return the user where they were headed.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return children;
}
