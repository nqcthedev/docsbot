'use client';

import { useState, useCallback } from 'react';
import { Type, Globe, FileText } from 'lucide-react';

import { cn } from 'src/utils/cn';

import { Card } from 'src/components/ui';

import { SourcePdfForm } from './source-pdf-form';
import { SourceTextForm } from './source-text-form';
import { SourceWebsiteForm } from './source-website-form';

// ----------------------------------------------------------------------

type SourceTab = 'website' | 'pdf' | 'text';

const TABS: { id: SourceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'website', label: 'Website', icon: <Globe /> },
  { id: 'pdf', label: 'PDF', icon: <FileText /> },
  { id: 'text', label: 'Text / FAQ', icon: <Type /> },
];

const tabId = (tab: SourceTab) => `add-source-tab-${tab}`;
const PANEL_ID = 'add-source-panel';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  maxPagesCap: number;
  maxUploadMb: number;
};

export function SourceAddForm({ botId, maxPagesCap, maxUploadMb }: Props) {
  const [activeTab, setActiveTab] = useState<SourceTab>('website');

  const handleSelectTab = useCallback((tab: SourceTab) => setActiveTab(tab), []);

  return (
    <Card>
      <div className="border-b border-zinc-100 px-5 pt-4">
        <h3 className="text-sm font-semibold">Add a source</h3>
        <div className="mt-3 flex gap-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              aria-controls={PANEL_ID}
              onClick={() => handleSelectTab(tab.id)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm [&_svg]:size-4',
                activeTab === tab.id
                  ? 'border-brand-600 font-medium text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(activeTab)} className="p-5">
        <SourceTabPanel
          tab={activeTab}
          botId={botId}
          maxPagesCap={maxPagesCap}
          maxUploadMb={maxUploadMb}
        />
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------

type SourceTabPanelProps = Props & {
  tab: SourceTab;
};

function SourceTabPanel({ tab, botId, maxPagesCap, maxUploadMb }: SourceTabPanelProps) {
  switch (tab) {
    case 'website':
      return <SourceWebsiteForm botId={botId} maxPagesCap={maxPagesCap} />;
    case 'pdf':
      return <SourcePdfForm botId={botId} maxUploadMb={maxUploadMb} />;
    case 'text':
      return <SourceTextForm botId={botId} />;
    default: {
      const unhandled: never = tab;
      return unhandled;
    }
  }
}
