import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { capitalize, useAwait, useObserveValue } from '@edvoapp/util';
import { RoutableProps } from 'preact-router';
import axios from 'axios';
import { AuthService, WebappExtensionBridge } from '../../service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// @ts-ignore
import { byPrefixAndName } from '@awesome.me/kit-687bab9fd2/icons';
import '@awesome.me/kit-687bab9fd2/icons';

import { ChromeStore, EdvoLogoFull } from '../../assets';
import * as VM from '../../viewmodel';
import {
  BgRoot,
  Card,
  CheckboxInput,
  CheckboxLabel,
  Container,
  InstallChromeButton,
  InstallChromeButtonBody,
  InstallChromeSubtext,
  InstallChromeText,
  InstallEdvoButton,
  RadioButtonInput,
  RadioButtonLabel,
  Step,
  StepsList,
  Subtitle,
  Title,
  Video,
  VideoOpacity,
  VideoWrapper,
} from './components';
import { Tooltip } from '../../components';
import { config } from '@edvoapp/common';

type Props = RoutableProps & { authService: AuthService };

export const Welcome = ({ authService }: Props) => {
  const [pinned, setPinned] = useState(false);
  const [nativeAppDownloaded, setNativeAppDownloaded] = useState(false);
  const fullName = useObserveValue(
    () =>
      authService.currentUserVertexObs.mapObs<string | undefined>((user) =>
        user
          ?.filterProperties({ role: ['full-name'] })
          .firstObs()
          .mapObs<string | undefined>((x) => x?.text),
      ),
    [authService],
  );

  const inputDevice = useObserveValue(
    () =>
      authService.currentUserVertexObs.mapObs<VM.InputDeviceType | null | undefined>((user) =>
        user?.getJsonPropValuesObs<VM.InputDeviceType>('input-device'),
      ),
    [authService],
  );

  const setInputDevice = useCallback(
    (type: 'mouse' | 'touchpad') =>
      authService.currentUserVertexObs.value?.setJsonPropValues('input-device', { type }, null),
    [authService],
  );

  const missingExt =
    useObserveValue(() => (authService.extBridge as WebappExtensionBridge).extensionStatus, [authService]) ===
    'NOT_INJECTED';

  const showConfetti = useMemo(
    () => !missingExt && pinned && !!inputDevice?.type && nativeAppDownloaded,
    [missingExt, pinned, inputDevice, nativeAppDownloaded],
  );

  const os = useMemo(() => {
    // const userAgent = window.navigator.userAgent;
    const platform = (window as any).navigator?.userAgentData?.platform || window.navigator.platform;
    const macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    // const iosPlatforms = ['iPhone', 'iPad', 'iPod'];

    if (macosPlatforms.indexOf(platform) !== -1) {
      return 'mac';
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
      return 'win';
    } else if (/Linux/.test(platform)) {
      return 'linux';
    } else {
      return null;
    }
    // } else if (iosPlatforms.indexOf(platform) !== -1) {
    //   return 'iOS';
    // } else if (/Android/.test(userAgent)) {
    //   return 'Android';
    // }
  }, []);

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

  const [showHowToPin, setShowHowToPin] = useState(false);

  const releaseUrl = releases && os ? releases[os] : null;

  return (
    <Container>
      <EdvoLogoFull style={{ position: 'fixed', left: 24, top: 32 }} />
      <Card>
        <Title>Let's get you started{fullName ? `, ${capitalize(fullName)}` : ''}! 🥳</Title>
        <Subtitle>Help us tailor your workspace.</Subtitle>
        <StepsList>
          <Step
            complete={!missingExt}
            index={0}
            headerText={'Install Chrome extension'}
            Body={() => (
              <a href={config.extensionURL} target="_blank">
                <InstallChromeButton>
                  <ChromeStore style={{ marginRight: 12 }} />
                  <InstallChromeButtonBody>
                    <InstallChromeText>Available in the</InstallChromeText>
                    <InstallChromeSubtext>Chrome Web Store</InstallChromeSubtext>
                  </InstallChromeButtonBody>
                </InstallChromeButton>
              </a>
            )}
          />
          <Step
            complete={!!pinned}
            index={1}
            headerText={'Pin Chrome extension to toolbar'}
            Body={() => (
              <CheckboxLabel>
                <CheckboxInput type="checkbox" checked={pinned} onChange={() => setPinned(!pinned)} />I did it!&nbsp;
                <Tooltip
                  popperConfig={{ placement: 'right' }}
                  tooltipChildren={
                    <div>
                      <video id="confetti-video" autoPlay muted playsInline className="object-cover">
                        <source src="/how-to-pin.mp4" type="video/mp4"></source>
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  }
                >
                  <a href="#" style={{ color: '#2563EB' }}>
                    Show me how
                  </a>
                </Tooltip>
              </CheckboxLabel>
            )}
          />
          <Step
            complete={!!inputDevice?.type}
            index={2}
            headerText={'Select your input device'}
            Body={() => (
              <>
                <RadioButtonLabel>
                  <RadioButtonInput
                    type="radio"
                    name="inputDevice"
                    value="mouse"
                    checked={inputDevice?.type === 'mouse'}
                    onChange={(e: any) => setInputDevice(e.target.value)}
                  />
                  Mouse
                </RadioButtonLabel>
                <RadioButtonLabel>
                  <RadioButtonInput
                    type="radio"
                    name="inputDevice"
                    value="touchpad"
                    checked={inputDevice?.type === 'touchpad'}
                    onChange={(e: any) => setInputDevice(e.target.value)}
                  />
                  Trackpad
                </RadioButtonLabel>
              </>
            )}
          />
          <Step
            complete={nativeAppDownloaded}
            index={3}
            headerText={'Install desktop app'}
            Body={() => (
              <InstallEdvoButton href={releases?.mac} onClick={() => setNativeAppDownloaded(true)}>
                <FontAwesomeIcon icon={byPrefixAndName.far['arrow-down-to-line']} style={{ marginRight: 12 }} />
                Get Edvo for MacOS
              </InstallEdvoButton>
            )}
          />
        </StepsList>
      </Card>
      <BgRoot>
        <VideoWrapper>
          <Video src="https://framerusercontent.com/assets/bPrI78NehaoXvWPp976g8i0kS24.mp4" loop muted playsInline />
        </VideoWrapper>
        <VideoOpacity />
      </BgRoot>
      {showConfetti ? (
        <video
          id="confetti-video"
          autoPlay
          muted
          playsInline
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300000,
          }}
          className="object-cover"
        >
          <source src="/transparent-confetti.webm" type="video/webm"></source>
          Your browser does not support the video tag.
        </video>
      ) : null}
    </Container>
  );
};
