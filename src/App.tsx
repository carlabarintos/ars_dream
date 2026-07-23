import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Layout } from '@/components/Layout'
import { Toaster } from '@/components/ui/sonner'
import { ProfilePage } from '@/features/auth/ProfilePage'
import { RequireAdmin, RequireAuth } from '@/features/auth/RequireAuth'
import { SignInPage } from '@/features/auth/SignInPage'
import { useAuthListener } from '@/features/auth/use-auth-listener'
import { AdminDashboard } from '@/features/admin/AdminDashboard'
import { AdminMessagesPage } from '@/features/admin/AdminMessagesPage'
import { PaymentReviewPage } from '@/features/admin/PaymentReviewPage'
import { QueueReviewPage } from '@/features/admin/QueueReviewPage'
import { QuestionnaireTemplatesPage } from '@/features/admin/QuestionnaireTemplatesPage'
import { UsersPage } from '@/features/admin/UsersPage'
import { MessagesPage } from '@/features/messages/MessagesPage'
import { PackageSelectionPage } from '@/features/marathons/PackageSelectionPage'
import { TimelinePage } from '@/features/marathons/TimelinePage'
import { MyRegistrationsPage } from '@/features/registrations/MyRegistrationsPage'

const queryClient = new QueryClient()

function AppRoutes() {
  useAuthListener()

  return (
    <Layout>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <TimelinePage />
            </RequireAuth>
          }
        />
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
