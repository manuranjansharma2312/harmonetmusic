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
import SubLabels from "./pages/SubLabels";
import AdminSubLabels from "./pages/AdminSubLabels";
import AdminSubLabelWithdrawals from "./pages/AdminSubLabelWithdrawals";
import SubLabelWithdrawals from "./pages/SubLabelWithdrawals";
import AdminLabels from "./pages/AdminLabels";
import AdminContentRequests from "./pages/AdminContentRequests";
import CopyrightClaimRemoval from "./pages/CopyrightClaimRemoval";
import InstagramLinkToSong from "./pages/InstagramLinkToSong";
import ContentIdMerge from "./pages/ContentIdMerge";
import OacApply from "./pages/OacApply";
import Takedown from "./pages/Takedown";
import CustomSupport from "./pages/CustomSupport";
import PlaylistPitching from "./pages/PlaylistPitching";
import Reports from "./pages/Reports";
import YouTubeReports from "./pages/YouTubeReports";
import AdminReports from "./pages/AdminReports";
import AdminYouTubeReports from "./pages/AdminYouTubeReports";
import Analytics from "./pages/Analytics";
import Revenue from "./pages/Revenue";
import AdminRevenue from "./pages/AdminRevenue";
import TermsConditions from "./pages/TermsConditions";
import AdminTermsConditions from "./pages/AdminTermsConditions";
import AdminInvoices from "./pages/AdminInvoices";
import AdminPosterGenerator from "./pages/AdminPosterGenerator";
import AdminNotices from "./pages/AdminNotices";
import AdminTutorials from "./pages/AdminTutorials";
import HelpTutorials from "./pages/HelpTutorials";
import AdminAgreements from "./pages/AdminAgreements";
import AdminAgreementGenerator from "./pages/AdminAgreementGenerator";
import AdminPromotionTools from "./pages/AdminPromotionTools";
import AdminPaymentSettings from "./pages/AdminPaymentSettings";
import PromotionTools from "./pages/PromotionTools";
import BankDetails from "./pages/BankDetails";
import ContactSupport from "./pages/ContactSupport";
import AdminContactSupport from "./pages/AdminContactSupport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

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
                  <Route path="/sub-labels" element={<ProtectedRoute><SubLabels /></ProtectedRoute>} />
                  <Route path="/sub-labels/withdrawals" element={<ProtectedRoute><SubLabelWithdrawals /></ProtectedRoute>} />
                  <Route path="/my-songs" element={<Navigate to="/my-releases" replace />} />
                  <Route path="/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
                  <Route path="/bank-details" element={<ProtectedRoute><BankDetails /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/submissions" element={<ProtectedRoute requiredRole="admin"><AdminSubmissions /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/labels" element={<ProtectedRoute requiredRole="admin"><AdminLabels /></ProtectedRoute>} />
                  <Route path="/admin/sub-labels" element={<ProtectedRoute requiredRole="admin"><AdminSubLabels /></ProtectedRoute>} />
                  <Route path="/admin/sub-label-withdrawals" element={<ProtectedRoute requiredRole="admin"><AdminSubLabelWithdrawals /></ProtectedRoute>} />
                  <Route path="/admin/content-requests" element={<ProtectedRoute requiredRole="admin"><AdminContentRequests /></ProtectedRoute>} />
                  <Route path="/admin/reports/ott" element={<ProtectedRoute requiredRole="admin"><AdminReports /></ProtectedRoute>} />
                  <Route path="/admin/reports/youtube" element={<ProtectedRoute requiredRole="admin"><AdminYouTubeReports /></ProtectedRoute>} />
                  {/* Legacy redirect */}
                  <Route path="/admin/reports" element={<Navigate to="/admin/reports/ott" replace />} />
                  <Route path="/revenue" element={<ProtectedRoute><Revenue /></ProtectedRoute>} />
                  <Route path="/admin/revenue" element={<ProtectedRoute requiredRole="admin"><AdminRevenue /></ProtectedRoute>} />
                  <Route path="/admin/terms" element={<ProtectedRoute requiredRole="admin"><AdminTermsConditions /></ProtectedRoute>} />
                  <Route path="/admin/invoices" element={<ProtectedRoute requiredRole="admin"><AdminInvoices /></ProtectedRoute>} />
                  <Route path="/admin/poster-generator" element={<ProtectedRoute requiredRole="admin"><AdminPosterGenerator /></ProtectedRoute>} />
                  <Route path="/admin/notices" element={<ProtectedRoute requiredRole="admin"><AdminNotices /></ProtectedRoute>} />
                  <Route path="/admin/tutorials" element={<ProtectedRoute requiredRole="admin"><AdminTutorials /></ProtectedRoute>} />
                  <Route path="/poster-generator" element={<ProtectedRoute><AdminPosterGenerator /></ProtectedRoute>} />
                  <Route path="/help-tutorials" element={<ProtectedRoute><HelpTutorials /></ProtectedRoute>} />
                  <Route path="/admin/agreements" element={<ProtectedRoute requiredRole="admin"><AdminAgreements /></ProtectedRoute>} />
                  <Route path="/admin/agreements/generate" element={<ProtectedRoute requiredRole="admin"><AdminAgreementGenerator /></ProtectedRoute>} />
                  <Route path="/admin/promotion-tools" element={<ProtectedRoute requiredRole="admin"><AdminPromotionTools /></ProtectedRoute>} />
                  <Route path="/admin/payment-settings" element={<ProtectedRoute requiredRole="admin"><AdminPaymentSettings /></ProtectedRoute>} />
                  <Route path="/promotion-tools" element={<ProtectedRoute><PromotionTools /></ProtectedRoute>} />
                  <Route path="/terms" element={<ProtectedRoute><TermsConditions /></ProtectedRoute>} />
                  <Route path="/tools/copyright-claim" element={<ProtectedRoute><CopyrightClaimRemoval /></ProtectedRoute>} />
                  <Route path="/tools/instagram-link" element={<ProtectedRoute><InstagramLinkToSong /></ProtectedRoute>} />
                  <Route path="/tools/content-id-merge" element={<ProtectedRoute><ContentIdMerge /></ProtectedRoute>} />
                  <Route path="/tools/oac-apply" element={<ProtectedRoute><OacApply /></ProtectedRoute>} />
                  <Route path="/tools/takedown" element={<ProtectedRoute><Takedown /></ProtectedRoute>} />
                  <Route path="/tools/custom-support" element={<ProtectedRoute><CustomSupport /></ProtectedRoute>} />
                  <Route path="/tools/playlist-pitching" element={<ProtectedRoute><PlaylistPitching /></ProtectedRoute>} />
                  <Route path="/reports/ott" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                  <Route path="/reports/youtube" element={<ProtectedRoute><YouTubeReports /></ProtectedRoute>} />
                  <Route path="/reports/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/admin/reports/analytics" element={<ProtectedRoute requiredRole="admin"><Analytics /></ProtectedRoute>} />
                  {/* Legacy redirect */}
                  <Route path="/reports" element={<Navigate to="/reports/ott" replace />} />
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
