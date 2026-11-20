import { paths } from 'src/routes/paths';

import { HomeCta } from '../home-cta';
import { HomeHero } from '../home-hero';
import { HomeFeatures } from '../home-features';
import { HomeSecurity } from '../home-security';
import { HomeHowItWorks } from '../home-how-it-works';

// ----------------------------------------------------------------------

type Props = {
  isSignedIn: boolean;
};

export function HomeView({ isSignedIn }: Props) {
  const ctaHref = isSignedIn ? paths.dashboard.root : paths.auth.signup;

  return (
    <>
      <HomeHero ctaHref={ctaHref} />
      <HomeFeatures />
      <HomeHowItWorks />
      <HomeSecurity />
      <HomeCta ctaHref={ctaHref} />
    </>
  );
}
