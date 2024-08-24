import { trxWrap } from '@edvoapp/common';
import { useMemo, useState } from 'preact/hooks';
import { VM } from '../../..';
import { EdvoLogoFull, SearchIcon } from '../../../assets';
import { UrlPaste } from '../../../behaviors/url-paste';

interface Props {
  node: VM.EmptyBrowser;
}
export const EmptyBrowser = ({ node }: Props) => {
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const body = useMemo(() => node.findClosest((n) => n instanceof VM.MemberBody && n), [node]);
  return (
    <div className="topic-card-body--empty-browser__inner">
      {/* Edvo icon + inspiring quote + instructions? */}
      <EdvoLogoFull />
      <div className="topic-card-body--empty-browser__search-input__wrapper">
        <SearchIcon />
        {/* TODO: convert to VM TextField */}
        <input
          autoFocus={true}
          type="text"
          value={inputUrl ?? ''}
          placeholder="Search the web or type a URL"
          className="focus-target topic-card-body--empty-browser__search-input"
          onChange={(e) => setInputUrl((e.target as HTMLInputElement).value)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' && inputUrl) {
              body?.updateUrl(inputUrl);
            }
          }}
          ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
        />
      </div>
    </div>
  );
};
