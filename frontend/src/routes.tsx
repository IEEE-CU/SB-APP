import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import AuthLayout from '@/components/layout/AuthLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/ProfilePage';
import SocietyListPage from '@/pages/societies/SocietyListPage';
import SocietyDetailPage from '@/pages/societies/SocietyDetailPage';
import SocietyFormPage from '@/pages/societies/SocietyFormPage';
import EventListPage from '@/pages/events/EventListPage';
import EventDetailPage from '@/pages/events/EventDetailPage';
import EventFormPage from '@/pages/events/EventFormPage';
import ProjectListPage from '@/pages/projects/ProjectListPage';
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage';
import ProjectFormPage from '@/pages/projects/ProjectFormPage';
import ReportListPage from '@/pages/reports/ReportListPage';
import ReportDetailPage from '@/pages/reports/ReportDetailPage';
import ReportFormPage from '@/pages/reports/ReportFormPage';
import AnnouncementListPage from '@/pages/announcements/AnnouncementListPage';
import AnnouncementDetailPage from '@/pages/announcements/AnnouncementDetailPage';
import AnnouncementFormPage from '@/pages/announcements/AnnouncementFormPage';
import CommunityPage from '@/pages/community/CommunityPage';
import UserManagementPage from '@/pages/admin/UserManagementPage';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <Layout />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/change-password', element: <ChangePasswordPage /> },
          { path: '/societies', element: <SocietyListPage /> },
          { path: '/societies/new', element: <SocietyFormPage /> },
          { path: '/societies/:id', element: <SocietyDetailPage /> },
          { path: '/societies/:id/edit', element: <SocietyFormPage /> },
          { path: '/events', element: <EventListPage /> },
          { path: '/events/new', element: <EventFormPage /> },
          { path: '/events/:id', element: <EventDetailPage /> },
          { path: '/events/:id/edit', element: <EventFormPage /> },
          { path: '/projects', element: <ProjectListPage /> },
          { path: '/projects/new', element: <ProjectFormPage /> },
          { path: '/projects/:id', element: <ProjectDetailPage /> },
          { path: '/projects/:id/edit', element: <ProjectFormPage /> },
          { path: '/reports', element: <ReportListPage /> },
          { path: '/reports/new', element: <ReportFormPage /> },
          { path: '/reports/:id', element: <ReportDetailPage /> },
          { path: '/reports/:id/edit', element: <ReportFormPage /> },
          { path: '/announcements', element: <AnnouncementListPage /> },
          { path: '/announcements/new', element: <AnnouncementFormPage /> },
          { path: '/announcements/:id', element: <AnnouncementDetailPage /> },
          { path: '/announcements/:id/edit', element: <AnnouncementFormPage /> },
          { path: '/community', element: <CommunityPage /> },
        ],
      },
      {
        element: <ProtectedRoute requiredModule="users" requiredAction="admin" />,
        children: [{ path: '/admin/users', element: <UserManagementPage /> }],
      },
    ],
  },
]);
