import { BrowserProfile, BrowserProfiles, Model, ProfileIdent, trxWrap } from '@edvoapp/common';
import { AuthService, globalAuthService } from '..';
import { Profile } from '../viewmodel';

export type SyncProfileSpec = { browserProfile: BrowserProfile; setDefault?: boolean };

export async function syncBrowserData(profilesToImport: SyncProfileSpec[]): Promise<void> {
  const authService = globalAuthService();
  const electronApi = window.electronAPI;
  if (!electronApi) return;

  const profilesByIdent: Record<string, Model.Vertex> = {};
  await Promise.all(
    (
      await authService.profilesObs.get()
    ).map(async (profile) => {
      const ident = await profile.getProperty({ role: ['profile-ident'] });
      profilesByIdent[ident?.text.value ?? profile.id] = profile;
    }),
  );

  const currentDefault = await authService.defaultProfile.get();
  let newDefault: Model.Vertex | null = null;

  await trxWrap(async (trx) => {
    for (let { browserProfile, setDefault = false } of profilesToImport) {
      let profile: Model.Vertex | null = profilesByIdent[browserProfile.ident];
      setDefault = setDefault && !newDefault;

      if (profile) {
        if (setDefault) {
          await profile.setFlagProperty('default-edvo-profile', setDefault, trx);
          newDefault = profile;
        }
      } else {
        profile = authService.createProfile(trx, browserProfile.name, browserProfile.ident, setDefault);
        if (!profile) continue;
        if (setDefault) newDefault = profile;
      }

      const res = await electronApi.cookies.import(browserProfile, profile.id);
      console.log('imported cookies:', res);
    }
    if (currentDefault && newDefault && newDefault !== currentDefault) {
      await currentDefault.setFlagProperty('default-edvo-profile', false, trx);
    }
  });
}

export async function listBrowserProfiles() {
  const electronApi = window.electronAPI;
  if (electronApi) {
    return await electronApi.browserProfiles.list();
  }
  return undefined;
}
