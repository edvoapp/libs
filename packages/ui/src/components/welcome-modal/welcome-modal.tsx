import { capitalize, useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';
import { createPortal, useCallback, useMemo, useState } from 'preact/compat';
import styled from 'styled-components';
import { MODAL_PANEL_Z } from '../../constants';
import {
  AuthService,
  MouseIcon,
  PlaybackIcon,
  TextButton,
  TrackpadIcon,
  UserAvatar,
  WebappExtensionBridge,
} from '../..';
import GoogleChrome from '../../assets/icons/google-chrome';
import { Check } from '../../assets/icons/check';
import { UpFromLine } from '../../assets/icons/up-from-line';
import { Model, config, trxWrap } from '@edvoapp/common';

interface Props {
  node: VM.WelcomeModal;
  authService: AuthService;
}

export const WelcomeModalRoot = styled.div<{
  unDimBackground?: boolean;
}>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  z-index: ${MODAL_PANEL_Z[0]};

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  background: ${(props) => (props.unDimBackground ? 'transparent' : 'rgba(0, 0, 0, 0.2)')};
  pointer-events: ${(props) => (props.unDimBackground ? 'none' : 'auto')};
`;
export const WelcomeModalSection = styled.div`
  width: 1110px;
  height: 675px;

  display: flex;
  justify-content: center;
  align-items: center;
  // font-size: 2rem;

  border-radius: 3px;
  //   border: 1px solid #e4e4e7;
  background: white;
  background-blend-mode: overlay, normal;

  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
`;
const IconText = styled.span`
  color: #6431df;
  text-align: center;
  leading-trim: both;
  text-edge: cap;
  font-family: Inter;
  font-size: 48px;
  font-style: normal;
  font-weight: 600;
  line-height: 150%; /* 72px */
  letter-spacing: 0.48px;
  display: flex;
  width: 128px;
  height: 128px;
  flex-direction: column;
  justify-content: center;
`;

export const WelcomeModal = ({ node, authService }: Props) => {
  const didInstallExt = useObserveValue(() => node.didInstallExt, [node]);
  const didPinExt = useObserveValue(() => node.didPinExtension, [node]);
  const showPinVideoHover = useObserveValue(() => node.showPinVideoButton.hover, [node]);
  const didSetInput = useObserveValue(() => node.didSetInput, [node]);
  const didChooseProfileImg = useObserveValue(() => node.didChooseProfileImg, [node]);
  const didChooseDefaultImg = useObserveValue(() => node.didChooseDefaultImg, [node]);
  const didCompleteSetup = useObserveValue(() => node.completedSetup, [node]);
  const showConfetti = useObserveValue(() => node.showConfetti, [node]);
  const [toUpload, setToUpload] = useState<string>('Choose File');
  const user = useObserveValue(() => node.context.authService.currentUserVertexObs, [node]);

  const firstName = useObserveValue(
    () =>
      node.context.authService.currentUserVertexObs.mapObs<string | undefined>((user) =>
        user
          ?.filterProperties({ role: ['full-name'] })
          .firstObs()
          .mapObs<string | undefined>((x) => {
            // Split the full name by spaces and take the first element as the first name
            const firstName = x?.text.value?.split(' ')[0];
            return firstName;
          }),
      ),
    [node],
  );

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

  const initials = useMemo(() => {
    if (!fullName) return null;

    let rgx = new RegExp(/\b[a-zA-Z]/, 'gu');
    let initials = Array.from(fullName.matchAll(rgx) || []);
    return ((initials.shift()?.[0] || '') + (initials.pop()?.[0] || '')).toUpperCase();
  }, [fullName]);

  const uploadFile = (file: File | null) => {
    if (!user) return;
    if (file) {
      // TODO: handle in VM
      void trxWrap(async (trx) => {
        (await user.filterProperties({ role: ['avatar-image'] }).toArray()).map((x) => x.archive(trx));
        const imgPart = await Model.Property.createAsync({
          parent: user,
          role: ['avatar-image'],
          contentHandle: file,
          trx,
          contentType: 'img',
          privs: Model.Priv.PrivState.defaultPublicReadonly(),
        });
      });
    }
  };

  const fileUpdated = useCallback((event: Event) => {
    event.preventDefault();
    const target = event.target as HTMLInputElement;
    const files: FileList = target.files!;
    if (files.length === 0) {
      event.preventDefault();
      setToUpload('Choose File');
      uploadFile(null);
    } else {
      setToUpload(files[0].name);
      uploadFile(files[0]);
      target.files = null; // reset chooser
    }
  }, []);

  return createPortal(
    <>
      <WelcomeModalRoot
        className="help-modal"
        ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
        unDimBackground={showConfetti}
      >
        {!didCompleteSetup || !showConfetti ? (
          <WelcomeModalSection>
            <section className="w-1/2 p-12 flex flex-col h-full gap-[72px]">
              <div>
                <h1 className="font-bold text-3xl">Welcome to Edvo, {firstName && capitalize(firstName)}! 🥳</h1>
                <p className="font-medium text-lg text-[#52525B] mt-4">
                  Before you dive in, help us tailor your workspace and setup experience.
                </p>
              </div>
              <section className="">
                <ul className="flex flex-col gap-9 font-medium">
                  <li className="flex gap-5">
                    <div className="h-full flex flex-col relative">
                      <div
                        className={`relative z-10 mt-1 w-4 h-4 rounded-full  flex items-center justify-center text-xs ${
                          didInstallExt ? 'bg-[#65A30D]' : 'bg-white border-2 border-[#27272A] text-[#27272A]'
                        }`}
                      >
                        {didInstallExt ? <Check width={10} height={10} fill={'white'} /> : <span>1</span>}
                      </div>
                      <div className="h-[100px] w-px bg-[#E4E4E7] absolute left-[8px] top-2 z-0"></div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`${didInstallExt && 'line-through'}`}>Install Chrome Extension</span>
                      <a
                        className={`py-2 px-3 flex gap-2 w-fit bg-[#FAFAFA] rounded-[3px] border border-[#E4E4E7] text-sm text-[#27272A] font-semibold cursor-pointer ${
                          !didInstallExt && 'hover:bg-[#5d34d719]'
                        } ${didInstallExt && 'opacity-50'} transition-all `}
                        href={config.extensionURL}
                        target="_blank"
                      >
                        <GoogleChrome width={16} height={16} /> Install Chrome Extension
                      </a>
                    </div>
                  </li>
                  <li className="flex gap-5">
                    <div className="h-full flex flex-col relative">
                      <div
                        className={`relative z-10 mt-1 w-4 h-4 rounded-full  flex items-center justify-center text-xs ${
                          didPinExt ? 'bg-[#65A30D]' : 'bg-white border-2 border-[#27272A] text-[#27272A]'
                        }`}
                      >
                        {didPinExt ? <Check width={10} height={10} fill={'white'} /> : <span>2</span>}
                      </div>
                      <div className="h-[100px] w-px bg-[#E4E4E7] absolute left-[8px] top-2 z-0"></div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`${didPinExt && 'line-through'}`}>Pin Chrome Extension to Toolbar</span>
                      <div className="flex gap-3">
                        <TextButton
                          node={node.pinExtButton}
                          backgroundColor={'#FAFAFA'}
                          borderColor={'#E4E4E7'}
                          fontColor={'#27272A'}
                          fontWeight="600"
                          hover={!didPinExt}
                          disableButton={didPinExt}
                        >
                          <span className="flex gap-2">
                            <Check width={16} height={16} fill={'#27272A'} /> I did it!
                          </span>
                        </TextButton>
                        <TextButton
                          node={node.showPinVideoButton}
                          backgroundColor={'#FAFAFA'}
                          borderColor={'#E4E4E7'}
                          fontColor={'#27272A'}
                          fontWeight="600"
                          hover={!didPinExt}
                          disableButton={didPinExt}
                        >
                          <span className="flex gap-2">
                            <PlaybackIcon width={16} height={16} fill={'#27272A'} /> Show me how
                          </span>
                        </TextButton>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-5">
                    <div className="h-full flex flex-col relative">
                      <div
                        className={`relative z-10 mt-1 w-4 h-4 rounded-full  flex items-center justify-center text-xs ${
                          didSetInput ? 'bg-[#65A30D]' : 'bg-white border-2 border-[#27272A] text-[#27272A]'
                        }`}
                      >
                        {didSetInput ? <Check width={10} height={10} fill={'white'} /> : <span>3</span>}
                      </div>
                      <div className="h-[100px] w-px bg-[#E4E4E7] absolute left-[8px] top-2 z-0"></div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`${didSetInput && 'line-through'}`}>Select your input device</span>
                      <div className="flex gap-3">
                        <TextButton
                          node={node.mouseInputButton}
                          backgroundColor={didSetInput !== 'mouse' ? '#FAFAFA' : ''}
                          borderColor={didSetInput !== 'mouse' ? '#E4E4E7' : ''}
                          fontColor={didSetInput !== 'mouse' ? '#27272A' : ''}
                          fontWeight="600"
                          hover={didSetInput !== 'mouse'}
                        >
                          <span className="flex gap-2">
                            <MouseIcon width={16} height={16} fill={didSetInput !== 'mouse' ? '#27272A' : '#ffffff'} />{' '}
                            Mouse
                          </span>
                        </TextButton>
                        <TextButton
                          node={node.trackpadInputButton}
                          backgroundColor={didSetInput !== 'touchpad' ? '#FAFAFA' : ''}
                          borderColor={didSetInput !== 'touchpad' ? '#E4E4E7' : ''}
                          fontColor={didSetInput !== 'touchpad' ? '#27272A' : ''}
                          fontWeight="600"
                          hover={didSetInput !== 'touchpad'}
                        >
                          <span className="flex gap-2">
                            <TrackpadIcon
                              width={16}
                              height={16}
                              fill={didSetInput !== 'touchpad' ? '#27272A' : '#ffffff'}
                            />{' '}
                            Trackpad
                          </span>
                        </TextButton>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-5">
                    <div
                      className={`relative z-10 mt-1 w-4 h-4 rounded-full  flex items-center justify-center text-xs ${
                        didChooseProfileImg || didChooseDefaultImg
                          ? 'bg-[#65A30D]'
                          : 'bg-white border-2 border-[#27272A] text-[#27272A]'
                      }`}
                    >
                      {didChooseProfileImg || didChooseDefaultImg ? (
                        <Check width={10} height={10} fill={'white'} />
                      ) : (
                        <span>4</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`${(didChooseProfileImg || didChooseDefaultImg) && 'line-through'}`}>
                        Choose your profile picture
                      </span>

                      <div className="flex gap-3 items-center">
                        <label
                          for={'avatar-choose'}
                          className={`py-2 px-3 w-fit bg-[#FAFAFA] rounded-[3px] border border-[#E4E4E7] text-sm text-[#27272A] font-semibold cursor-pointer hover:bg-[#5d34d719] transition-all `}
                        >
                          <span className="flex gap-2 cursor-pointer">
                            <UpFromLine width={16} height={16} /> Upload
                          </span>
                          <input
                            type="file"
                            id={'avatar-choose'}
                            // accept={accept}
                            onChange={fileUpdated}
                            style={{
                              cursor: 'pointer',
                              display: 'none',
                            }}
                          />
                        </label>

                        {!didChooseProfileImg ? (
                          <>
                            <span>or</span>
                            <AvatarInitialsButton
                              node={node.defaultAvatarButton}
                              key={node.key + 'initials'}
                              initials={initials}
                              didChooseProfileImg={didChooseDefaultImg}
                            />
                          </>
                        ) : (
                          <UserAvatar node={node.userAvatar} />
                        )}
                      </div>
                    </div>
                  </li>
                </ul>
              </section>
            </section>
            <section className="w-1/2 bg-gray-300 h-full overflow-hidden">
              {showPinVideoHover ? (
                <video
                  id="pin-video"
                  autoPlay
                  muted
                  playsInline
                  loop
                  style="width:auto; height:100%;"
                  className="object-cover"
                >
                  <source src="/pin.mp4" type="video/mp4"></source>
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img src="/welcome-illustration.png" className="object-cover h-full"></img>
              )}
            </section>
          </WelcomeModalSection>
        ) : (
          <video
            id="confetti-video"
            autoPlay
            muted
            playsInline
            style={{
              width: 'auto',
              height: '100%',
              zIndex: 300000,
            }}
            className="object-cover"
          >
            <source src="/transparent-confetti.webm" type="video/webm"></source>
            Your browser does not support the video tag.
          </video>
        )}
      </WelcomeModalRoot>
    </>,
    document.body,
  );
};

const AvatarInitialsButton = ({
  node,
  initials,
  didChooseProfileImg,
}: {
  node: VM.Button;
  initials: string | null;
  didChooseProfileImg: boolean;
}) => {
  return (
    <button
      ref={(r: HTMLButtonElement | null) => node.safeBindDomElement(r)}
      className={`avatar-initials-button m-1.5 w-12 h-12 rounded-full bg-[#C026D3] text-white flex items-center justify-center transition-all ${
        didChooseProfileImg && 'border-4 border-[#65A30D]'
      }`}
    >
      <span>{initials}</span>
    </button>
  );
};
