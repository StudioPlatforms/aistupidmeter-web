'use client';

import { useRouter, usePathname } from 'next/navigation';
import TopBar from './v4/TopBar';
import MobileNav from './v4/MobileNav';

interface SubpageLayoutProps {
  children: React.ReactNode;
}

export default function SubpageLayout({ children }: SubpageLayoutProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  // Drives which nav item renders as active. 'pricing' and 'watchlist' are not
  // view modes of the dashboard, but the nav needs to highlight them.
  const selectedView = (pathname === '/about' || pathname === '/methodology') ? 'about'
    : pathname === '/faq' ? 'faq'
    : pathname === '/pricing' ? 'pricing'
    : pathname === '/watchlist' ? 'watchlist'
    : 'dashboard';

  const handleViewChange = (view: 'dashboard' | 'about' | 'faq') => {
    switch (view) {
      case 'dashboard': router.push('/'); break;
      case 'about': router.push('/about'); break;
      case 'faq': router.push('/faq'); break;
    }
  };

  return (
    <>
      <TopBar
        selectedView={selectedView}
        onViewChange={handleViewChange}
        visitorCount={null}
        todayVisits={null}
      />
      {children}
      <MobileNav
        selectedView={selectedView}
        onViewChange={handleViewChange}
      />
    </>
  );
}
