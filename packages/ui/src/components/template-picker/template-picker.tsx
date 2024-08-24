import 'react-modal';
import { config, Model } from '@edvoapp/common';
import { ModalOld, VM } from '../..';
import { Observable } from '@edvoapp/util';
import styled from 'styled-components';
import { applyTopicSpaceTemplate } from '../../viewmodel';

export const templates = ['production', 'nightly', 'staging'].includes(config.env || '')
  ? [
      {
        label: 'Daily Communications',
        id: 'FvMn9mkKN8nYY7GlY7Es',
      },
      // {
      //   label: 'Top Priorities',
      //   id: 'PyRSumlyRs4Rf62KQqa3',
      // },
      // {
      //   label: 'Learning in Public',
      //   id: 'j44CArIbjyUwXdDKsnPT',
      // },
    ]
  : [
      {
        label: 'Test template (hard-code ID)',
        id: 'Looix9xfD3i0lqbJ0Dp8',
      },
    ];

type Props = {
  topic: Model.Vertex;
  isOpen: Observable<boolean>;
  node: VM.Node;
};

const TemplateList = styled.div`
  display: flex;
`;

const TemplateItem = styled.div`
  cursor: pointer;
  flex: 1;
  border: solid 1px black;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background-color: #00000022;
  }
`;

export const TemplatePicker = ({ topic, isOpen, node }: Props) => {
  return (
    <ModalOld
      isOpen={isOpen.value}
      onRequestClose={() => isOpen.set(false)}
      contentLabel="Pick a template"
      shouldCloseOnEsc
      shouldCloseOnOverlayClick
    >
      <TemplateList>
        {templates.map(({ label, id }) => (
          <TemplateItem
            key={id}
            onClick={() => {
              void applyTopicSpaceTemplate(topic, id, node.context);
              isOpen.set(false);
            }}
          >
            {label}
          </TemplateItem>
        ))}
      </TemplateList>
    </ModalOld>
  );
};
