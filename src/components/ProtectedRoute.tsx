import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AppLayout } from '@/components/AppLayout';

interface ProtectedRouteProps {
  children: React.ReactNode;
  skipLayout?: boolean;
}

export const ProtectedRoute = ({ children, skipLayout }: ProtectedRouteProps) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Admin pages have their own AdminLayout, skip AppLayout wrapper
  if (skipLayout) {
    return <>{children}</>;
  }

  // wrap authenticated pages with layout that includes navigation
  return <AppLayout>{children}</AppLayout>;
};
