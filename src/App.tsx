import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";

import { AuthProvider } from "@/hooks/useAuth";
import { ImpersonateProvider } from "@/hooks/useImpersonate";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import UserDashboard from "./pages/UserDashboard";
import NewRelease from "./pages/NewRelease";
import AdminGenresLanguages from "./pages/AdminGenresLanguages";
import MyReleases from "./pages/MyReleases";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSubmissions from "./pages/AdminSubmissions";
import AdminUsers from "./pages/AdminUsers";
import MyProfile from "./pages/MyProfile";
import MyLabels from "./pages/MyLabels";
import AdminLabels from "./pages/AdminLabels";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof document === "undefined") return true;
    const stored = document.cookie.match(/(?:^|; )sidebar:state=([^;]+)/)?.[1];
    return stored !== "false";
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <AuthProvider>
              <ImpersonateProvider>
                <Routes>
                  <Route path="/" element={<Navigate to="/auth" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
                  <Route path="/submit" element={<ProtectedRoute><NewRelease /></ProtectedRoute>} />
                  <Route path="/admin/genres-languages" element={<ProtectedRoute requiredRole="admin"><AdminGenresLanguages /></ProtectedRoute>} />
                  <Route path="/my-releases" element={<ProtectedRoute><MyReleases /></ProtectedRoute>} />
                  <Route path="/my-labels" element={<ProtectedRoute><MyLabels /></ProtectedRoute>} />
                  <Route path="/my-songs" element={<Navigate to="/my-releases" replace />} />
                  <Route path="/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/submissions" element={<ProtectedRoute requiredRole="admin"><AdminSubmissions /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/labels" element={<ProtectedRoute requiredRole="admin"><AdminLabels /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ImpersonateProvider>
            </AuthProvider>
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
