import { CONFIG } from 'src/config-global';

import { LoginView } from 'src/auth/view';
import { redirectIfAuthenticated } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Log in · ${CONFIG.appName}` };

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function Page({ searchParams }: Props) {
  await redirectIfAuthenticated();
  const { next } = await searchParams;
  return <LoginView next={typeof next === 'string' ? next : undefined} />;
}
