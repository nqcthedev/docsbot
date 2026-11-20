type Props = {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
};

/** Placeholder for a list or panel that has nothing to show yet. */
export function EmptyState({ icon, title, children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-3 rounded-full bg-zinc-100 p-3 text-zinc-500 [&_svg]:size-5">{icon}</div>
      ) : null}
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-zinc-500">{children}</div> : null}
    </div>
  );
}
