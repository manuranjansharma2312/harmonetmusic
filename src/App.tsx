import { useState, lazy, Suspense, forwardRef } from "react";
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

// Retry wrapper for lazy imports — auto-retries on network failures
function lazyRetry(fn: () => Promise<any>, retries = 2): ReturnType<typeof lazy> {
  return lazy(() =>
    fn().catch((err) => {
      if (retries > 0) {
        return new Promise<any>((resolve) => setTimeout(resolve, 1000)).then(() =>
          lazyRetry(fn, retries - 1) as any
        );
      }
      // Force reload on persistent failure (stale chunk)
      window.location.reload();
      throw err;
    })
  );
}

// Lazy load all pages with retry
const Auth = lazyRetry(() => import("./pages/Auth"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const UserDashboard = lazyRetry(() => import("./pages/UserDashboard"));
const NewRelease = lazyRetry(() => import("./pages/NewRelease"));
const AdminGenresLanguages = lazyRetry(() => import("./pages/AdminGenresLanguages"));
const MyReleases = lazyRetry(() => import("./pages/MyReleases"));
const AdminDashboard = lazyRetry(() => import("./pages/AdminDashboard"));
const AdminAllPending = lazyRetry(() => import("./pages/AdminAllPending"));
const AdminSubmissions = lazyRetry(() => import("./pages/AdminSubmissions"));
const AdminTransferHistory = lazyRetry(() => import("./pages/AdminTransferHistory"));
const AdminUsers = lazyRetry(() => import("./pages/AdminUsers"));
const MyProfile = lazyRetry(() => import("./pages/MyProfile"));
const MyLabels = lazyRetry(() => import("./pages/MyLabels"));
const SubLabels = lazyRetry(() => import("./pages/SubLabels"));
const AdminSubLabels = lazyRetry(() => import("./pages/AdminSubLabels"));
const AdminSubLabelWithdrawals = lazyRetry(() => import("./pages/AdminSubLabelWithdrawals"));
const SubLabelWithdrawals = lazyRetry(() => import("./pages/SubLabelWithdrawals"));
const AdminLabels = lazyRetry(() => import("./pages/AdminLabels"));
const AdminContentRequests = lazyRetry(() => import("./pages/AdminContentRequests"));
const CopyrightClaimRemoval = lazyRetry(() => import("./pages/CopyrightClaimRemoval"));
const InstagramLinkToSong = lazyRetry(() => import("./pages/InstagramLinkToSong"));
const ContentIdMerge = lazyRetry(() => import("./pages/ContentIdMerge"));
const OacApply = lazyRetry(() => import("./pages/OacApply"));
const Takedown = lazyRetry(() => import("./pages/Takedown"));
const CustomSupport = lazyRetry(() => import("./pages/CustomSupport"));
const PlaylistPitching = lazyRetry(() => import("./pages/PlaylistPitching"));
const Reports = lazyRetry(() => import("./pages/Reports"));
const YouTubeReports = lazyRetry(() => import("./pages/YouTubeReports"));
const AdminReports = lazyRetry(() => import("./pages/AdminReports"));
const AdminYouTubeReports = lazyRetry(() => import("./pages/AdminYouTubeReports"));
const Analytics = lazyRetry(() => import("./pages/Analytics"));
const Revenue = lazyRetry(() => import("./pages/Revenue"));
const AdminRevenue = lazyRetry(() => import("./pages/AdminRevenue"));
const TermsConditions = lazyRetry(() => import("./pages/TermsConditions"));
const AdminTermsConditions = lazyRetry(() => import("./pages/AdminTermsConditions"));
const AdminInvoices = lazyRetry(() => import("./pages/AdminInvoices"));
const AdminPosterGenerator = lazyRetry(() => import("./pages/AdminPosterGenerator"));
const AdminNotices = lazyRetry(() => import("./pages/AdminNotices"));
const AdminTutorials = lazyRetry(() => import("./pages/AdminTutorials"));
const HelpTutorials = lazyRetry(() => import("./pages/HelpTutorials"));
const AdminAgreements = lazyRetry(() => import("./pages/AdminAgreements"));
const AdminAgreementGenerator = lazyRetry(() => import("./pages/AdminAgreementGenerator"));
const AdminPromotionTools = lazyRetry(() => import("./pages/AdminPromotionTools"));
const AdminPaymentSettings = lazyRetry(() => import("./pages/AdminPaymentSettings"));
const AdminPromotionalSettings = lazyRetry(() => import("./pages/AdminPromotionalSettings"));
const PromotionTools = lazyRetry(() => import("./pages/PromotionTools"));
const BankDetails = lazyRetry(() => import("./pages/BankDetails"));
const ContactSupport = lazyRetry(() => import("./pages/ContactSupport"));
const AdminContactSupport = lazyRetry(() => import("./pages/AdminContactSupport"));
const AdminAIImageSystem = lazyRetry(() => import("./pages/AdminAIImageSystem"));
const AIImageGeneration = lazyRetry(() => import("./pages/AIImageGeneration"));
const SmartLink = lazyRetry(() => import("./pages/SmartLink"));
const MySmartLinks = lazyRetry(() => import("./pages/MySmartLinks"));
const AdminSmartLinks = lazyRetry(() => import("./pages/AdminSmartLinks"));
const AdminEmailSettings = lazyRetry(() => import("./pages/AdminEmailSettings"));
const AdminSiteSettings = lazyRetry(() => import("./pages/AdminSiteSettings"));
const AdminBrandingSettings = lazyRetry(() => import("./pages/AdminBrandingSettings"));
const AdminSignatureDocuments = lazyRetry(() => import("./pages/AdminSignatureDocuments"));
const AdminSignatureDetail = lazyRetry(() => import("./pages/AdminSignatureDetail"));
const AdminSignatureFields = lazyRetry(() => import("./pages/AdminSignatureFields"));
const AdminSignatureSettings = lazyRetry(() => import("./pages/AdminSignatureSettings"));
const SignDocument = lazyRetry(() => import("./pages/SignDocument"));
const DownloadSignedPdf = lazyRetry(() => import("./pages/DownloadSignedPdf"));
const AdminVideoForms = lazyRetry(() => import("./pages/AdminVideoForms"));
const AdminVideoFormBuilder = lazyRetry(() => import("./pages/AdminVideoFormBuilder"));
const AdminVideoSubmissions = lazyRetry(() => import("./pages/AdminVideoSubmissions"));
const AdminVevoChannels = lazyRetry(() => import("./pages/AdminVevoChannels"));
const VideoSubmit = lazyRetry(() => import("./pages/VideoSubmit"));
const MyVideos = lazyRetry(() => import("./pages/MyVideos"));
const VevoChannels = lazyRetry(() => import("./pages/VevoChannels"));
const AdminVideoGuidelines = lazyRetry(() => import("./pages/AdminVideoGuidelines"));
const VideoGuidelines = lazyRetry(() => import("./pages/VideoGuidelines"));
const AdminVevoReports = lazyRetry(() => import("./pages/AdminVevoReports"));
const VevoReports = lazyRetry(() => import("./pages/VevoReports"));
const AdminVevoSettings = lazyRetry(() => import("./pages/AdminVevoSettings"));
const YouTubeCmsLink = lazyRetry(() => import("./pages/YouTubeCmsLink"));
const AdminYouTubeCmsLinks = lazyRetry(() => import("./pages/AdminYouTubeCmsLinks"));
const AdminCmsReports = lazyRetry(() => import("./pages/AdminCmsReports"));
const CmsReports = lazyRetry(() => import("./pages/CmsReports"));
const CmsBalance = lazyRetry(() => import("./pages/CmsBalance"));
const CmsAnalytics = lazyRetry(() => import("./pages/CmsAnalytics"));
const AdminCmsWithdrawals = lazyRetry(() => import("./pages/AdminCmsWithdrawals"));
const AdminYouTubeCmsSettings = lazyRetry(() => import("./pages/AdminYouTubeCmsSettings"));
const AdminAccountSecurity = lazyRetry(() => import("./pages/AdminAccountSecurity"));
const AdminTeamManagement = lazyRetry(() => import("./pages/AdminTeamManagement"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

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
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
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
                      <Route path="/admin/all-pending" element={<ProtectedRoute requiredRole="admin"><AdminAllPending /></ProtectedRoute>} />
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
                      <Route path="/admin/promotional-settings" element={<ProtectedRoute requiredRole="admin"><AdminPromotionalSettings /></ProtectedRoute>} />
                      <Route path="/admin/contact-support" element={<ProtectedRoute requiredRole="admin"><AdminContactSupport /></ProtectedRoute>} />
                      <Route path="/admin/email-settings" element={<ProtectedRoute requiredRole="admin"><AdminEmailSettings /></ProtectedRoute>} />
                      <Route path="/admin/ai-image-system" element={<ProtectedRoute requiredRole="admin"><AdminAIImageSystem /></ProtectedRoute>} />
                      <Route path="/admin/site-settings" element={<ProtectedRoute requiredRole="admin"><AdminSiteSettings /></ProtectedRoute>} />
                      <Route path="/admin/vevo-settings" element={<ProtectedRoute requiredRole="admin"><AdminVevoSettings /></ProtectedRoute>} />
                      <Route path="/admin/branding-settings" element={<ProtectedRoute requiredRole="admin"><AdminBrandingSettings /></ProtectedRoute>} />
                      <Route path="/admin/team-management" element={<ProtectedRoute requiredRole="admin"><AdminTeamManagement /></ProtectedRoute>} />
                      <Route path="/admin/account-security" element={<ProtectedRoute requiredRole="admin"><AdminAccountSecurity /></ProtectedRoute>} />
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
                      <Route path="/cms-reports" element={<ProtectedRoute><CmsReports /></ProtectedRoute>} />
                      <Route path="/cms-balance" element={<ProtectedRoute><CmsBalance /></ProtectedRoute>} />
                      <Route path="/cms-analytics" element={<ProtectedRoute><CmsAnalytics /></ProtectedRoute>} />
                      <Route path="/admin/youtube-cms-links" element={<ProtectedRoute requiredRole="admin"><AdminYouTubeCmsLinks /></ProtectedRoute>} />
                      <Route path="/admin/cms-reports" element={<ProtectedRoute requiredRole="admin"><AdminCmsReports /></ProtectedRoute>} />
                      <Route path="/admin/cms-withdrawals" element={<ProtectedRoute requiredRole="admin"><AdminCmsWithdrawals /></ProtectedRoute>} />
                      <Route path="/admin/youtube-cms-settings" element={<ProtectedRoute requiredRole="admin"><AdminYouTubeCmsSettings /></ProtectedRoute>} />
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
