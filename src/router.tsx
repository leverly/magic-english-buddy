/**
 * Magic English Buddy - 路由配置
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loading } from '@/components/common/Loading';
import { LessonGuard } from '@/components/common/LessonGuard';
import { RouteError } from '@/components/common/RouteError';

/**
 * public/404.html forwards GitHub Pages deep-link misses to the app root with
 * the original path in ?redirect=. Rewrite the URL before the router reads it,
 * so a shared /reader/l1_001 link opens that lesson on a cold visit instead of
 * the GitHub 404 page.
 */
const restoreRedirectedPath = (): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const redirect = url.searchParams.get('redirect');
  if (!redirect) return;
  url.searchParams.delete('redirect');
  const suffix = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
  // The bounce target is a route inside the deployed base path
  // (/magic-english-buddy/), so the base must be restored alongside the path:
  // without it the router sees an unknown route and falls back to onboarding.
  const base = import.meta.env.BASE_URL || '/';
  const path = redirect.replace(/^\/+/, '');
  const target = `${base.replace(/\/$/, '')}/${path}${suffix}`;
  window.history.replaceState(null, '', new URL(target, url.origin).toString());
};

restoreRedirectedPath();

// 懒加载页面组件
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const ReaderPage = lazy(() => import('@/pages/ReaderPage'));
const QuizPage = lazy(() => import('@/pages/QuizPage'));
const ScrollPage = lazy(() => import('@/pages/ScrollPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ReviewPage = lazy(() => import('@/pages/ReviewPage'));
const CertificatePage = lazy(() => import('@/pages/CertificatePage'));

// 加载组件包装器
const PageLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <Loading fullscreen message="加载中..." />
    }
  >
    {children}
  </Suspense>
);

// 路由配置
export const router = createBrowserRouter(
  [{ errorElement: <RouteError />, children: [
    {
      path: '/',
      element: <Navigate to="/onboarding" replace />,
    },
    {
      path: '/onboarding',
      element: (
        <PageLoader>
          <OnboardingPage />
        </PageLoader>
      ),
    },
    {
      path: '/map',
      element: (
        <PageLoader>
          <MapPage />
        </PageLoader>
      ),
    },
    {
      path: '/reader/:storyId',
      element: (
        <PageLoader>
          <LessonGuard><ReaderPage /></LessonGuard>
        </PageLoader>
      ),
    },
    {
      path: '/quiz/:storyId',
      element: (
        <PageLoader>
          <LessonGuard requireReading><QuizPage /></LessonGuard>
        </PageLoader>
      ),
    },
    {
      path: '/scroll',
      element: (
        <PageLoader>
          <ScrollPage />
        </PageLoader>
      ),
    },
    {
      path: '/settings',
      element: (
        <PageLoader>
          <SettingsPage />
        </PageLoader>
      ),
    },
    { path: '/review', element: <PageLoader><ReviewPage /></PageLoader> },
    { path: '/certificate', element: <PageLoader><CertificatePage /></PageLoader> },
    {
      path: '*',
      element: <Navigate to="/onboarding" replace />,
    },
  ] }],
  {
    basename: '/magic-english-buddy',
  }
);

export default router;
