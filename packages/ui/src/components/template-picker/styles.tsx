import { Observable } from '@edvoapp/util';
import { ModalOld } from '../..';

type Props = ReactModal.Props & {
  isOpen: Observable<boolean>;
};

export const TemplatePicker = ({ isOpen }: Props) => {
  return (
    <ModalOld
      isOpen={isOpen.value}
      onRequestClose={() => isOpen.set(false)}
      contentLabel="Pick a template"
      shouldCloseOnEsc
      shouldCloseOnOverlayClick
    >
      <div>hi</div>
    </ModalOld>
  );
};
