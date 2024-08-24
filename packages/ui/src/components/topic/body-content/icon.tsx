import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import { useMemo } from 'preact/hooks';
import styled from 'styled-components';
import { Note, ObjectIcon } from '../../../assets';
import * as VM from '../../../viewmodel';
import * as Icons from './icons';

export const IconSC = styled.div``;

interface Props {
  node: VM.FileIcon;
}

export const Icon = ({ node }: Props) => {
  const property = useObserveValue(() => node.property, [node]);
  const fileExtensionProperty = useObserveValue(() => node.fileExtensionProperty, [node]);
  const faviconProperty = useObserveValueMaybe(() => node.faviconProperty, [node]);
  const extension = useObserveValueMaybe(() => fileExtensionProperty?.text, [fileExtensionProperty]);

  const favicon = useObserveValueMaybe(() => faviconProperty?.text, [faviconProperty]);

  const Icon = useMemo(() => {
    if (!property || !fileExtensionProperty) return ObjectIcon;
    const contentType = property.contentType;
    if (contentType.startsWith('video')) return Icons.Movie;
    switch (contentType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
      case 'application/vnd.apple.pages':
        return Icons.Doc;
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
      case 'application/vnd.apple.numbers':
      case 'text/csv':
        return Icons.Excel;
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      case 'application/vnd.ms-powerpoint':
        return Icons.Powerpoint;
      case 'text/html':
        return Icons.Html;
      case 'text/plain':
        return Icons.Text;
      case 'application/vnd.apple.keynote':
        return Icons.Keynote;
      default:
        return Icons.File;
    }
  }, [property, fileExtensionProperty]);

  if (favicon) return <img alt="Icon" src={favicon} ref={(r: HTMLElement | null) => node.safeBindDomElement(r)} />;

  return (
    <IconSC ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <Icon>{extension && `.${extension}`}</Icon>
    </IconSC>
  );
};
