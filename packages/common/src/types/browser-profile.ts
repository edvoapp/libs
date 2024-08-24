export type BrowserKind = 'Chrome';
export type Platform = 'win32' | 'darwin' | 'linux';
export type BrowserProfiles = Record<ProfileIdent, BrowserProfile>;

export type ProfileIdent = string;

export type BrowserProfile = {
  browserKind: BrowserKind;
  browserDirPath: string;
  ident: ProfileIdent;
  name: string;
  dirPath: string;
  avatarUrl: string;
  isDefault: boolean;
};

export type ProfileDetails = {
  active_time?: number;
  avatar_icon?: string;
  background_apps?: boolean;
  default_avatar_fill_color?: number;
  default_avatar_stroke_color?: number;
  first_account_name_hash?: number;
  force_signin_profile_locked?: boolean;
  gaia_given_name?: string;
  gaia_id?: number;
  gaia_name?: string;
  gaia_picture_file_name?: string;
  hosted_domain?: string;
  is_consented_primary_account?: boolean;
  is_ephemeral?: boolean;
  is_using_default_avatar?: boolean;
  is_using_default_name?: boolean;
  last_downloaded_gaia_picture_url_with_size: string;
  managed_user_id?: string;
  metrics_bucket_index?: number;
  name: string;
  profile_highlight_color?: number;
  'signin.with_credential_provider'?: boolean;
  use_gaia_picture?: boolean;
  user_accepted_account_management?: boolean;
  user_name?: string;
  profile_identifier?: string;
  default?: boolean; // added
};
