import { Model, trxWrapSync } from '@edvoapp/common';
import { DateFormat, formatDate } from '../../utils';
import { MobileLayout, NoteForm } from '../../components';
import { EdvoLogoFull } from '../../assets';

/**
 * The application rendered on mobile devices.
 */
export function MobileApp() {
  return (
    <div
      style={{
        padding: 16,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <EdvoLogoFull className="pl-logo" data-cy="edvo-logo" />

      <span style={{ textAlign: 'center', marginTop: 24 }}>
        Edvo on mobile is coming soon! To start connecting your knowledge now, switch to desktop 😊
      </span>
    </div>
  );
  return (
    <MobileLayout
      noteForm={
        <NoteForm
          header={formatDate(DateFormat.MonthDayYear)}
          focus={1}
          onSubmit={(text: string) => {
            trxWrapSync((trx) => {
              const vertex = Model.Vertex.create({
                trx,
                name: 'Quick Capture',
              });
              vertex.createProperty({
                trx,
                role: ['body'],
                contentType: 'text/plain',
                initialString: text,
              });
            });
            return { error: null };
          }}
        />
      }
    />
  );
}
