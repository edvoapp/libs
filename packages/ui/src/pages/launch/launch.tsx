import { useAwait } from '@edvoapp/util';
import axios from 'axios';
import { Button, Container, Footer, Heading, Link, Paragraph, Root } from './shared';
import { useEffect, useMemo } from 'preact/hooks';
import * as VM from '../../viewmodel';
import { route } from 'preact-router';

type Props = { node: VM.Launch };

export const Launch = ({ node }: Props) => {
  const url = useAwait(async () => {
    const url = await node.getLaunchUrl();
    if (!url) return route('/auth/login');
    window.location.href = url;
    return url.toString();
  }, [node]);

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
        {url && <Button href={url}>Open Edvo</Button>}
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
