import cx from 'classnames';
import { FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './pdf-outline.scss';

type Size = {
  width: number;
  height?: number;
};
export type OutlineItem = {
  title: string;
  pageIndex: number | null;
  bold: boolean;
  italic: boolean;
};
type PdfOutlineProps = {
  outlines: OutlineItem[];
  size: Size;
  currentPage: number;
  outlineSelect: Function;
};

export const PdfOutline: FunctionComponent<PdfOutlineProps> = ({ size, outlineSelect, currentPage = 1, outlines }) => {
  const [activeOutline, setActiveOutline] = useState<OutlineItem | null>(null);

  useEffect(() => {
    const activeOutline = outlines
      .slice()
      .reverse()
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .find(({ pageIndex }) => pageIndex <= currentPage);
    if (activeOutline) setActiveOutline(activeOutline);
  }, [currentPage, outlines]);

  return (
    <ul
      className="outline-list"
      style={{
        width: size.width,
      }}
    >
      {outlines.map((o) => (
        <li
          className={cx({
            active: activeOutline === o,
            italic: o.italic,
            bold: o.bold,
          })}
          onClick={() => outlineSelect(o)}
        >
          {o.title}
        </li>
      ))}
    </ul>
  );
};
