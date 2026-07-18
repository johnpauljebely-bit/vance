import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import Work from "@/pages/Work";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import NotFound from "@/pages/NotFound";
import StaffLogin from "@/pages/StaffLogin";
import ClientPortalLogin from "@/pages/ClientPortalLogin";
import ClientPortalLayout from "@/pages/portal/ClientPortalLayout";
import ClientPortalHome from "@/pages/portal/ClientPortalHome";
import ClientPortalOrder from "@/pages/portal/ClientPortalOrder";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminMessages from "@/pages/admin/AdminMessages";
import AdminTaskBoard from "@/pages/admin/AdminTaskBoard";
import AdminAutomation from "@/pages/admin/AdminAutomation";
import AdminTemplates from "@/pages/admin/AdminTemplates";
import AdminCalendar from "@/pages/admin/AdminCalendar";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminClients from "@/pages/admin/AdminClients";
import AdminClientDetail from "@/pages/admin/AdminClientDetail";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminPlaceholder from "@/pages/admin/AdminPlaceholder";
import SmoothScroll from "@/lib/SmoothScroll";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <SmoothScroll />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Work />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/portal/login" element={<ClientPortalLogin />} />

          {/* Client portal (email + 6-digit OTP login) */}
          <Route path="/portal" element={<ClientPortalLayout />}>
            <Route index element={<ClientPortalHome />} />
            <Route path="orders/:id" element={<ClientPortalOrder />} />
          </Route>

          {/* Admin dashboard */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="clients/:email" element={<AdminClientDetail />} />
            <Route path="taskboard" element={<AdminTaskBoard />} />
            <Route path="automation" element={<AdminAutomation />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="templates" element={<AdminTemplates />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
