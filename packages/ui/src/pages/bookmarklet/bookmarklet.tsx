import { RoutableProps } from 'preact-router';
import { Bookmarklet } from '../../components';

interface Props extends RoutableProps {}

export function BookmarkletPage(props: Props) {
  return (
    <section>
      <Bookmarklet />
    </section>
  );
}
