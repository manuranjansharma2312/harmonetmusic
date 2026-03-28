import { useState, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";

import { AuthProvider } from "@/hooks/useAuth";
import { ImpersonateProvider } from "@/hooks/useImpersonate";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SiteSettingsRuntime } from "@/components/SiteSettingsRuntime";
import { BrandingHead } from "@/components/BrandingHead";

// Lazy load all pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const NewRelease = lazy(() => import("./pages/NewRelease"));
const AdminGenresLanguages = lazy(() => import("./pages/AdminGenresLanguages"));
const MyReleases = lazy(() => import("./pages/MyReleases"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSubmissions = lazy(() => import("./pages/AdminSubmissions"));
const AdminTransferHistory = lazy(() => import("./pages/AdminTransferHistory"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const MyLabels = lazy(() => import("./pages/MyLabels"));
const SubLabels = lazy(() => import("./pages/SubLabels"));
const AdminSubLabels = lazy(() => import("./pages/AdminSubLabels"));
const AdminSubLabelWithdrawals = lazy(() => import("./pages/AdminSubLabelWithdrawals"));
const SubLabelWithdrawals = lazy(() => import("./pages/SubLabelWithdrawals"));
const AdminLabels = lazy(() => import("./pages/AdminLabels"));
const AdminContentRequests = lazy(() => import("./pages/AdminContentRequests"));
const CopyrightClaimRemoval = lazy(() => import("./pages/CopyrightClaimRemoval"));
const InstagramLinkToSong = lazy(() => import("./pages/InstagramLinkToSong"));
const ContentIdMerge = lazy(() => import("./pages/ContentIdMerge"));
const OacApply = lazy(() => import("./pages/OacApply"));
const Takedown = lazy(() => import("./pages/Takedown"));
const CustomSupport = lazy(() => import("./pages/CustomSupport"));
const PlaylistPitching = lazy(() => import("./pages/PlaylistPitching"));
const Reports = lazy(() => import("./pages/Reports"));
const YouTubeReports = lazy(() => import("./pages/YouTubeReports"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminYouTubeReports = lazy(() => import("./pages/AdminYouTubeReports"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Revenue = lazy(() => import("./pages/Revenue"));
const AdminRevenue = lazy(() => import("./pages/AdminRevenue"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));
const AdminTermsConditions = lazy(() => import("./pages/AdminTermsConditions"));
const AdminInvoices = lazy(() => import("./pages/AdminInvoices"));
const AdminPosterGenerator = lazy(() => import("./pages/AdminPosterGenerator"));
const AdminNotices = lazy(() => import("./pages/AdminNotices"));
const AdminTutorials = lazy(() => import("./pages/AdminTutorials"));
const HelpTutorials = lazy(() => import("./pages/HelpTutorials"));
const AdminAgreements = lazy(() => import("./pages/AdminAgreements"));
const AdminAgreementGenerator = lazy(() => import("./pages/AdminAgreementGenerator"));
const AdminPromotionTools = lazy(() => import("./pages/AdminPromotionTools"));
const AdminPaymentSettings = lazy(() => import("./pages/AdminPaymentSettings"));
const PromotionTools = lazy(() => import("./pages/PromotionTools"));
const BankDetails = lazy(() => import("./pages/BankDetails"));
const ContactSupport = lazy(() => import("./pages/ContactSupport"));
const AdminContactSupport = lazy(() => import("./pages/AdminContactSupport"));
const AdminAIImageSystem = lazy(() => import("./pages/AdminAIImageSystem"));
const AIImageGeneration = lazy(() => import("./pages/AIImageGeneration"));
const SmartLink = lazy(() => import("./pages/SmartLink"));
const MySmartLinks = lazy(() => import("./pages/MySmartLinks"));
const AdminSmartLinks = lazy(() => import("./pages/AdminSmartLinks"));
const AdminEmailSettings = lazy(() => import("./pages/AdminEmailSettings"));
const AdminSiteSettings = lazy(() => import("./pages/AdminSiteSettings"));
const AdminBrandingSettings = lazy(() => import("./pages/AdminBrandingSettings"));
const AdminSignatureDocuments = lazy(() => import("./pages/AdminSignatureDocuments"));
const AdminSignatureDetail = lazy(() => import("./pages/AdminSignatureDetail"));
const AdminSignatureFields = lazy(() => import("./pages/AdminSignatureFields"));
const AdminSignatureSettings = lazy(() => import("./pages/AdminSignatureSettings"));
const SignDocument = lazy(() => import("./pages/SignDocument"));
const DownloadSignedPdf = lazy(() => import("./pages/DownloadSignedPdf"));
const AdminVideoForms = lazy(() => import("./pages/AdminVideoForms"));
const AdminVideoFormBuilder = lazy(() => import("./pages/AdminVideoFormBuilder"));
const AdminVideoSubmissions = lazy(() => import("./pages/AdminVideoSubmissions"));
const AdminVevoChannels = lazy(() => import("./pages/AdminVevoChannels"));
const VideoSubmit = lazy(() => import("./pages/VideoSubmit"));
const MyVideos = lazy(() => import("./pages/MyVideos"));
const VevoChannels = lazy(() => import("./pages/VevoChannels"));
const AdminVideoGuidelines = lazy(() => import("./pages/AdminVideoGuidelines"));
const VideoGuidelines = lazy(() => import("./pages/VideoGuidelines"));
const AdminVevoReports = lazy(() => import("./pages/AdminVevoReports"));
const VevoReports = lazy(() => import("./pages/VevoReports"));
const AdminVevoSettings = lazy(() => import("./pages/AdminVevoSettings"));
const YouTubeCmsLink = lazy(() => import("./pages/YouTubeCmsLink"));
const AdminYouTubeCmsLinks = lazy(() => import("./pages/AdminYouTubeCmsLinks"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60000, // 60s — reduce redundant refetches
      gcTime: 300000, // 5min — keep cache longer
    },
    mutations: {
      retry: 0,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof document === "undefined") return true;
    const stored = document.cookie.match(/(?:^|; )sidebar:state=([^;]+)/)?.[1];
    return stored !== "false";
  });

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <AuthProvider>
                <ImpersonateProvider>
                  <SiteSettingsRuntime />
                  <BrandingHead />
                  <Suspense fallback={<PageLoader />}>
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
                      <Route path="/admin/transfer-history" element={<ProtectedRoute requiredRole="admin"><AdminTransferHistory /></ProtectedRoute>} />
                      <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
                      <Route path="/admin/labels" element={<ProtectedRoute requiredRole="admin"><AdminLabels /></ProtectedRoute>} />
                      <Route path="/admin/sub-labels" element={<ProtectedRoute requiredRole="admin"><AdminSubLabels /></ProtectedRoute>} />
                      <Route path="/admin/sub-label-withdrawals" element={<ProtectedRoute requiredRole="admin"><AdminSubLabelWithdrawals /></ProtectedRoute>} />
                      <Route path="/admin/content-requests" element={<ProtectedRoute requiredRole="admin"><AdminContentRequests /></ProtectedRoute>} />
                      <Route path="/admin/reports/ott" element={<ProtectedRoute requiredRole="admin"><AdminReports /></ProtectedRoute>} />
                      <Route path="/admin/reports/youtube" element={<ProtectedRoute requiredRole="admin"><AdminYouTubeReports /></ProtectedRoute>} />
                      <Route path="/admin/reports/vevo" element={<ProtectedRoute requiredRole="admin"><AdminVevoReports /></ProtectedRoute>} />
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
                      <Route path="/admin/contact-support" element={<ProtectedRoute requiredRole="admin"><AdminContactSupport /></ProtectedRoute>} />
                      <Route path="/admin/email-settings" element={<ProtectedRoute requiredRole="admin"><AdminEmailSettings /></ProtectedRoute>} />
                      <Route path="/admin/ai-image-system" element={<ProtectedRoute requiredRole="admin"><AdminAIImageSystem /></ProtectedRoute>} />
                      <Route path="/admin/site-settings" element={<ProtectedRoute requiredRole="admin"><AdminSiteSettings /></ProtectedRoute>} />
                      <Route path="/admin/vevo-settings" element={<ProtectedRoute requiredRole="admin"><AdminVevoSettings /></ProtectedRoute>} />
                      <Route path="/admin/branding-settings" element={<ProtectedRoute requiredRole="admin"><AdminBrandingSettings /></ProtectedRoute>} />
                      <Route path="/ai-images" element={<ProtectedRoute><AIImageGeneration /></ProtectedRoute>} />
                      <Route path="/promotion-tools" element={<ProtectedRoute><PromotionTools /></ProtectedRoute>} />
                      <Route path="/terms" element={<ProtectedRoute><TermsConditions /></ProtectedRoute>} />
                      <Route path="/contact-support" element={<ProtectedRoute><ContactSupport /></ProtectedRoute>} />
                      <Route path="/tools/copyright-claim" element={<ProtectedRoute><CopyrightClaimRemoval /></ProtectedRoute>} />
                      <Route path="/tools/instagram-link" element={<ProtectedRoute><InstagramLinkToSong /></ProtectedRoute>} />
                      <Route path="/tools/content-id-merge" element={<ProtectedRoute><ContentIdMerge /></ProtectedRoute>} />
                      <Route path="/tools/oac-apply" element={<ProtectedRoute><OacApply /></ProtectedRoute>} />
                      <Route path="/tools/takedown" element={<ProtectedRoute><Takedown /></ProtectedRoute>} />
                      <Route path="/tools/custom-support" element={<ProtectedRoute><CustomSupport /></ProtectedRoute>} />
                      <Route path="/tools/playlist-pitching" element={<ProtectedRoute><PlaylistPitching /></ProtectedRoute>} />
                      <Route path="/reports/ott" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                      <Route path="/reports/youtube" element={<ProtectedRoute><YouTubeReports /></ProtectedRoute>} />
                      <Route path="/reports/vevo" element={<ProtectedRoute><VevoReports /></ProtectedRoute>} />
                      <Route path="/reports/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                      <Route path="/admin/reports/analytics" element={<ProtectedRoute requiredRole="admin"><Analytics /></ProtectedRoute>} />
                      <Route path="/reports" element={<Navigate to="/reports/ott" replace />} />
                      <Route path="/smart-links" element={<ProtectedRoute><MySmartLinks /></ProtectedRoute>} />
                      <Route path="/admin/smart-links" element={<ProtectedRoute requiredRole="admin"><AdminSmartLinks /></ProtectedRoute>} />
                      <Route path="/admin/signatures" element={<ProtectedRoute requiredRole="admin"><AdminSignatureDocuments /></ProtectedRoute>} />
                      <Route path="/admin/signature-settings" element={<ProtectedRoute requiredRole="admin"><AdminSignatureSettings /></ProtectedRoute>} />
                      <Route path="/admin/signature/:id" element={<ProtectedRoute requiredRole="admin"><AdminSignatureDetail /></ProtectedRoute>} />
                      <Route path="/admin/signature/:id/fields" element={<ProtectedRoute requiredRole="admin"><AdminSignatureFields /></ProtectedRoute>} />
                      <Route path="/sign/:token" element={<SignDocument />} />
                      <Route path="/download/:documentId" element={<DownloadSignedPdf />} />
                      <Route path="/r/:slug" element={<SmartLink />} />
                      <Route path="/video/upload" element={<ProtectedRoute><VideoSubmit /></ProtectedRoute>} />
                      <Route path="/video/vevo-channel" element={<ProtectedRoute><VideoSubmit /></ProtectedRoute>} />
                      <Route path="/my-videos" element={<ProtectedRoute><MyVideos /></ProtectedRoute>} />
                      <Route path="/vevo-channels" element={<ProtectedRoute><VevoChannels /></ProtectedRoute>} />
                      <Route path="/admin/video-forms" element={<ProtectedRoute requiredRole="admin"><AdminVideoForms /></ProtectedRoute>} />
                      <Route path="/admin/video-forms/builder" element={<ProtectedRoute requiredRole="admin"><AdminVideoFormBuilder /></ProtectedRoute>} />
                      <Route path="/admin/video-submissions" element={<ProtectedRoute requiredRole="admin"><AdminVideoSubmissions /></ProtectedRoute>} />
                      <Route path="/admin/vevo-channels" element={<ProtectedRoute requiredRole="admin"><AdminVevoChannels /></ProtectedRoute>} />
                      <Route path="/admin/video-guidelines" element={<ProtectedRoute requiredRole="admin"><AdminVideoGuidelines /></ProtectedRoute>} />
                      <Route path="/video-guidelines" element={<ProtectedRoute><VideoGuidelines /></ProtectedRoute>} />
                      <Route path="/youtube-cms-link" element={<ProtectedRoute><YouTubeCmsLink /></ProtectedRoute>} />
                      <Route path="/admin/youtube-cms-links" element={<ProtectedRoute requiredRole="admin"><AdminYouTubeCmsLinks /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ImpersonateProvider>
              </AuthProvider>
            </SidebarProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
