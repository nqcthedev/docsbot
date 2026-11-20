import type { ISourceItem } from 'src/types/source';

import { SourceList } from '../source-list';
import { SourceAddForm } from '../source-add-form';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  sources: ISourceItem[];
  maxPagesCap: number;
  maxUploadMb: number;
};

export function SourceListView({ botId, sources, maxPagesCap, maxUploadMb }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <SourceAddForm botId={botId} maxPagesCap={maxPagesCap} maxUploadMb={maxUploadMb} />
      </div>
      <SourceList botId={botId} sources={sources} />
    </div>
  );
}
