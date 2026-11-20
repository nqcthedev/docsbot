import { MainFooter } from './footer';
import { MainHeader } from './header';

// ----------------------------------------------------------------------

type Props = {
  isSignedIn: boolean;
  children: React.ReactNode;
};

/** Marketing pages: sticky header, page content, footer. */
export function MainLayout({ isSignedIn, children }: Props) {
  return (
    <div className="bg-white">
      <MainHeader isSignedIn={isSignedIn} />
      {children}
      <MainFooter />
    </div>
  );
}
