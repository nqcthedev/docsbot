import { Card } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
};

export function BotStatTile({ icon, label, value, caption }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-400">{caption}</div>
    </Card>
  );
}
