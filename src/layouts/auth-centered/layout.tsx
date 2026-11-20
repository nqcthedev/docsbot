import { Logo } from 'src/components/logo';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

/** Log-in and sign-up: the logo above a narrow, centred card. */
export function AuthCenteredLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-brand-50),transparent_60%)] px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
