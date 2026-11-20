import { MainLayout } from 'src/layouts/main';
import { getCurrentUser } from 'src/server/auth/session';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default async function Layout({ children }: Props) {
  const user = await getCurrentUser();
  return <MainLayout isSignedIn={Boolean(user)}>{children}</MainLayout>;
}
