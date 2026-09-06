import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Layout } from '@/components/Layout'
import { Toaster } from '@/components/ui/sonner'
import { PageSpinner } from '@/components/ui/spinner'
import { ProfilePage } from '@/features/auth/ProfilePage'
import { RequireAdmin, RequireAuth, RequireFinanceAccess } from '@/features/auth/RequireAuth'
import { SignInPage } from '@/features/auth/SignInPage'
import { useAuthStore } from '@/features/auth/auth-store'
import { useAuthListener } from '@/features/auth/use-auth-listener'
import { AdminDashboard } from '@/features/admin/AdminDashboard'
import { AdminMessagesPage } from '@/features/admin/AdminMessagesPage'
import { AuditLogPage } from '@/features/admin/AuditLogPage'
import { FunnelAnalyticsPage } from '@/features/admin/FunnelAnalyticsPage'
import { PaymentReviewPage } from '@/features/admin/PaymentReviewPage'
import { QueueReviewPage } from '@/features/admin/QueueReviewPage'
import { QuestionnaireTemplatesPage } from '@/features/admin/QuestionnaireTemplatesPage'
import { RevenuePage } from '@/features/admin/RevenuePage'
import { UsersPage } from '@/features/admin/UsersPage'
import { LandingPage } from '@/features/marketing/LandingPage'
import { LegalContentPage } from '@/features/admin/LegalContentPage'
import { PrivacyPolicyPage } from '@/features/legal/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/features/legal/TermsOfServicePage'
import { MessagesPage } from '@/features/messages/MessagesPage'
import { PackageSelectionPage } from '@/features/marathons/PackageSelectionPage'
import { TimelinePage } from '@/features/marathons/TimelinePage'
import { MyRegistrationsPage } from '@/features/registrations/MyRegistrationsPage'

const queryClient = new QueryClient()

/** Signed-out visitors get the public marketing landing page; signed-in users keep the Timeline feed. */
function HomeRoute() {
  const firebaseUser = useAuthStore((state) => state.firebaseUser)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) return <PageSpinner label="Warming up…" />
  return firebaseUser ? <TimelinePage /> : <LandingPage />
}

function AppRoutes() {
  useAuthListener()

  return (
    <Layout>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/" element={<HomeRoute />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route
          path="/marathons/:marathonId/packages"
          element={
            <RequireAuth>
              <PackageSelectionPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/my-registrations"
          element={
            <RequireAuth>
              <MyRegistrationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <MessagesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/messages"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminMessagesPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/marathons/:marathonId/queue"
          element={
            <RequireAuth>
              <RequireAdmin>
                <QueueReviewPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/marathons/:marathonId/payments"
          element={
            <RequireAuth>
              <RequireAdmin>
                <PaymentReviewPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/questionnaire-templates"
          element={
            <RequireAuth>
              <RequireAdmin>
                <QuestionnaireTemplatesPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth>
              <RequireAdmin>
                <UsersPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AuditLogPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/funnel-analytics"
          element={
            <RequireAuth>
              <RequireAdmin>
                <FunnelAnalyticsPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/revenue"
          element={
            <RequireAuth>
              <RequireFinanceAccess>
                <RevenuePage />
              </RequireFinanceAccess>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/legal-content"
          element={
            <RequireAuth>
              <RequireAdmin>
                <LegalContentPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
