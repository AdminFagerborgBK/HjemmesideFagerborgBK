import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
const NewsArchive = lazy(() => import('./pages/NewsArchive'));
const NewsArticle = lazy(() => import('./pages/NewsArticle'));
const Matches = lazy(() => import('./pages/Matches'));
const PlayerSquad = lazy(() => import('./pages/PlayerSquad'));
const Membership = lazy(() => import('./pages/Membership'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const NewsletterPreferences = lazy(() => import('./pages/NewsletterPreferences'));
const LeagueTableFull = lazy(() => import('./pages/LeagueTableFull'));
const Videos = lazy(() => import('./pages/Videos'));
const VideoCategory = lazy(() => import('./pages/VideoCategory'));
const Contact = lazy(() => import('./pages/Contact'));
const Board = lazy(() => import('./pages/Board'));
const BecomePartner = lazy(() => import('./pages/BecomePartner'));
const GoalClub = lazy(() => import('./pages/GoalClub'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('./pages/NotFound'));
import { AdminGuard } from "./components/admin/AdminGuard";
import ScrollToTop from "./components/ScrollToTop";

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminPosts = lazy(() => import('./pages/admin/AdminPosts'));
const AdminPostEdit = lazy(() => import('./pages/admin/AdminPostEdit'));
const AdminVideos = lazy(() => import('./pages/admin/AdminVideos'));
const AdminVideoEdit = lazy(() => import('./pages/admin/AdminVideoEdit'));
const AdminRoster = lazy(() => import('./pages/admin/AdminRoster'));
const AdminRosterEdit = lazy(() => import('./pages/admin/AdminRosterEdit'));
const AdminPages = lazy(() => import('./pages/admin/AdminPages'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminSponsors = lazy(() => import('./pages/admin/AdminSponsors'));
const AdminSponsorEdit = lazy(() => import('./pages/admin/AdminSponsorEdit'));
const AdminMembers = lazy(() => import('./pages/admin/AdminMembers'));
const AdminMatches = lazy(() => import('./pages/admin/AdminMatches'));
const AdminMatchEdit = lazy(() => import('./pages/admin/AdminMatchEdit'));
const AdminBoard = lazy(() => import('./pages/admin/AdminBoard'));
const AdminStandings = lazy(() => import('./pages/admin/AdminStandings'));
const AdminGDPR = lazy(() => import('./pages/admin/AdminGDPR'));
const AdminNewsletterEdit = lazy(() => import('./pages/admin/AdminNewsletterEdit'));
const AdminNewsletterRecipients = lazy(() => import('./pages/admin/AdminNewsletterRecipients'));
const AdminNewsletters = lazy(() => import('./pages/admin/AdminNewsletters'));
const FacebookCallback = lazy(() => import('./pages/admin/FacebookCallback'));
const TikTokCallback = lazy(() => import('./pages/admin/TikTokCallback'));
const AdminLivestreamStats = lazy(() => import('./pages/admin/AdminLivestreamStats'));
const AdminGoalClub = lazy(() => import('./pages/admin/AdminGoalClub'));
const AdminSyncStatus = lazy(() => import('./pages/admin/AdminSyncStatus'));
const AdminGrasrot = lazy(() => import('./pages/admin/AdminGrasrot'));
const AdminInstagram = lazy(() => import('./pages/admin/AdminInstagram'));
const BecomePlayer = lazy(() => import('./pages/BecomePlayer'));
const PlayerOnboarding = lazy(() => import('./pages/PlayerOnboarding'));
const AdminPlayerEnrollment = lazy(() => import('./pages/admin/AdminPlayerEnrollment'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Public content changes rarely: serve from cache instead of re-querying
      // the database on every mount, rerender or tab focus.
      // refetchOnMount stays enabled (default behaviour) so that queries marked
      // stale by an invalidation while unmounted (e.g. admin edit -> back to list)
      // refetch on remount. Fresh queries within staleTime still serve from cache.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<main className="min-h-dvh pt-28" aria-busy="true"><div className="container mx-auto px-4" role="status">Laster…</div></main>}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/instagram-callback" element={<AdminInstagram />} />
          
          {/* Admin routes - protected by AdminGuard which checks for site_admin/superadmin role */}
          <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/admin/posts" element={<AdminGuard><AdminPosts /></AdminGuard>} />
          <Route path="/admin/posts/:id" element={<AdminGuard><AdminPostEdit /></AdminGuard>} />
          <Route path="/admin/videos" element={<AdminGuard><AdminVideos /></AdminGuard>} />
          <Route path="/admin/videos/:id" element={<AdminGuard><AdminVideoEdit /></AdminGuard>} />
          <Route path="/admin/roster" element={<AdminGuard><AdminRoster /></AdminGuard>} />
          <Route path="/admin/roster/:id" element={<AdminGuard><AdminRosterEdit /></AdminGuard>} />
          <Route path="/admin/pages" element={<AdminGuard><AdminPages /></AdminGuard>} />
          <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
          <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
          <Route path="/admin/sponsors" element={<AdminGuard><AdminSponsors /></AdminGuard>} />
          <Route path="/admin/sponsors/:id" element={<AdminGuard><AdminSponsorEdit /></AdminGuard>} />
          <Route path="/admin/members" element={<AdminGuard><AdminMembers /></AdminGuard>} />
          <Route path="/admin/board" element={<AdminGuard><AdminBoard /></AdminGuard>} />
          <Route path="/admin/standings" element={<AdminGuard><AdminStandings /></AdminGuard>} />
          <Route path="/admin/matches" element={<AdminGuard><AdminMatches /></AdminGuard>} />
          <Route path="/admin/matches/:id" element={<AdminGuard><AdminMatchEdit /></AdminGuard>} />
          <Route path="/admin/gdpr" element={<AdminGuard><AdminGDPR /></AdminGuard>} />
          <Route path="/admin/facebook-callback" element={<FacebookCallback />} />
          <Route path="/admin/tiktok-callback" element={<TikTokCallback />} />
          <Route path="/admin/newsletters" element={<AdminGuard><AdminNewsletters /></AdminGuard>} />
          <Route path="/admin/newsletter-mottakere" element={<AdminGuard><AdminNewsletterRecipients /></AdminGuard>} />
          <Route path="/admin/newsletters/:id" element={<AdminGuard><AdminNewsletterEdit /></AdminGuard>} />
          <Route path="/admin/livestream-stats" element={<AdminGuard><AdminLivestreamStats /></AdminGuard>} />
          <Route path="/admin/goal-club" element={<AdminGuard><AdminGoalClub /></AdminGuard>} />
          <Route path="/admin/sync-status" element={<AdminGuard><AdminSyncStatus /></AdminGuard>} />
          <Route path="/admin/grasrot" element={<AdminGuard><AdminGrasrot /></AdminGuard>} />
          <Route path="/admin/instagram" element={<AdminGuard><AdminInstagram /></AdminGuard>} />
          <Route path="/admin/player-enrollment" element={<AdminGuard><AdminPlayerEnrollment /></AdminGuard>} />

          
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/nyheter" element={<NewsArchive />} />
          <Route path="/nyheter/:slug" element={<NewsArticle />} />
          <Route path="/kamper" element={<Matches />} />
          <Route path="/spillerstall" element={<PlayerSquad />} />
          <Route path="/bli-medlem" element={<Membership />} />
          <Route path="/bli-spiller" element={<BecomePlayer />} />
          <Route path="/spillerinnmelding" element={<PlayerOnboarding />} />
          <Route path="/om-klubben" element={<About />} />
           <Route path="/kontakt" element={<Contact />} />
           <Route path="/styret" element={<Board />} />
          <Route path="/tabell" element={<LeagueTableFull />} />
          <Route path="/videoer" element={<Videos />} />
          <Route path="/videoer/:category" element={<VideoCategory />} />
          <Route path="/personvern" element={<Privacy />} />
          <Route path="/nyhetsbrev" element={<NewsletterPreferences />} />
          <Route path="/vilkar" element={<Terms />} />
          <Route path="/bli-partner" element={<BecomePartner />} />
          <Route path="/malklubben" element={<GoalClub />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
