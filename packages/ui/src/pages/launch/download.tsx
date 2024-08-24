import { useAwait } from '@edvoapp/util';
import axios from 'axios';
import { Button, Container, Footer, Heading, Link, Paragraph, Root } from './shared';
import { AuthService } from '../../service';
import { useMemo } from 'preact/hooks';

type Props = { authService: AuthService };

// TODO: actually come to think of it, maybe this can merge with launch.tsx and we can conditionalize sp.set('topicId')
export const Download = ({ authService }: Props) => {
  const token = useAwait(() => authService.generateAuthToken(), [authService]);

  const url = useMemo(() => {
    const url = new URL('edvo://open');
    const sp = new URLSearchParams(url.search);
    if (token) sp.set('token', token);
    url.search = sp.toString();
    return url.toString();
  }, [token]);

  const releases = useAwait(async () => {
    const { data } = await axios.get<{
      assets: { name: string; browser_download_url: string }[];
    }>('https://api.github.com/repos/edvoapp/edvo-release/releases/latest');

    const assets = data.assets;
    const res: Partial<Record<'mac' | 'linux' | 'win', string>> = {};

    for (const asset of assets) {
      const { name, browser_download_url } = asset;
      if (name.endsWith('.dmg')) res.mac = browser_download_url;
      if (name.endsWith('.exe')) res.win = browser_download_url;
      if (name.endsWith('.AppImage')) res.linux = browser_download_url;
    }

    return res;
  }, []);

  return (
    <Root>
      <Container>
        <Heading>Your things are ready in the Edvo app!</Heading>
        <Button href={url}>Open Edvo</Button>
      </Container>
      <Footer>
        <Paragraph>
          Don't have the Edvo app installed? <Link href={releases?.mac}>Download Now for Mac</Link>
          <br />
          <br />
          Windows coming soon
        </Paragraph>
      </Footer>
    </Root>
  );
};
