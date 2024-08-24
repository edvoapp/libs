import { useAwait, useObserveValue } from '@edvoapp/util';
import { MODAL_PANEL_Z, SyncProfileSpec, VM, listBrowserProfiles, syncBrowserData } from '../..';
import { createPortal, useState } from 'preact/compat';

interface Props {
  node: VM.SyncProfilesModal;
}

export const SyncProfilesModal = ({ node }: Props) => {
  const user = useObserveValue(() => node.context.authService.currentUserVertexObs, [node]);
  if (!user) return null;

  const profiles = useAwait(async () => {
    const profiles_ = (await listBrowserProfiles()) ?? {};
    const browsersRecord: Record<string, Record<string, SyncProfileSpec>> = {};
    const profilesRecord: Record<string, SyncProfileSpec> = {};

    for (const [ident, browserProfile] of Object.entries(profiles_)) {
      const browserKind = browserProfile.browserKind;
      profilesRecord[ident] = { browserProfile, setDefault: false };
      browsersRecord[browserKind] = profilesRecord;
    }

    return browsersRecord;
  }, []);
  if (!profiles) return null;

  const style = {
    backgroundColor: 'white',
    border: 'solid 1px rgba(0, 0, 0, 0.1)',
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.1)',
    borderRadius: '5px',
    width: '320px',
    height: 'auto',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: MODAL_PANEL_Z[0],
  };

  const [profilesToImport, setProfilesToImport] = useState<SyncProfileSpec[]>([]);
  const handleCheckboxChange = (spec: SyncProfileSpec) => {
    spec.setDefault = true;
    setProfilesToImport((prev) => {
      if (prev.length > 0) prev[0].setDefault = false;
      return [spec];
    });
  };

  const profilesList = <ProfilesList profiles={profiles ?? null} handleCheckboxChange={handleCheckboxChange} />;

  return createPortal(
    <>
      <div
        className="overlay top-0 left-0 w-screen h-screen pointer-events-none bg-black/40 fixed"
        style={{ zIndex: MODAL_PANEL_Z[0] - 1 }}
      ></div>
      <div ref={(r: HTMLElement | null) => node.safeBindDomElement(r)} style={style}>
        <div className=" ReactModal__Content">
          <div class="mb-6">
            <p class="text-xl font-bold">Sync your Chrome profiles</p>
            <p class="text-xs pl-px pt-px">to automatically sign in to your favorite websites.</p>
          </div>

          {/* List importable profiles from supported browsers */}
          {profilesList}

          <button
            class="bg-indigo-600 text-gray-100 mt-4 mb-2 text-[11.5px] py-1.5"
            onClick={async () => {
              await syncBrowserData(profilesToImport);
              node.upgrade()?.parentNode.upgrade()?.close();
            }}
          >
            Sync
          </button>
          <button class="bg-gray-100 text-natural-950 text-[11.5px] py-1.5" onClick={() => node.parentNode.close()}>
            Skip, I'll sign in manually every time
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
};

const ProfilesList = ({
  profiles,
  handleCheckboxChange,
}: {
  profiles: Record<string, Record<string, SyncProfileSpec>> | null;
  handleCheckboxChange: any;
}) => {
  if (!profiles) return null;

  return (
    <div class="text-xs mb-8">
      {Object.entries(profiles).map(([browser, profilesRecord]) => (
        <>
          <p class="font-medium mb-2">{`${browser}`} Profiles</p>
          {Object.entries(profilesRecord).map(([ident, spec]) => {
            const { browserProfile: profile, setDefault } = spec;
            const name = profile.name;
            return (
              <ul class="ml-2">
                <li key={ident} class="mb-1.5">
                  <label class="flex items-center">
                    <input
                      type="radio"
                      checked={setDefault || false}
                      onChange={() => {
                        handleCheckboxChange(spec);
                      }}
                    />
                    <span class="ml-2 mt-0.5">{`${name}`}</span>
                  </label>
                </li>
              </ul>
            );
          })}
        </>
      ))}
    </div>
  );
};
