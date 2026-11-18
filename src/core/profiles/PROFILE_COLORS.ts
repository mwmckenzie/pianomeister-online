import { THEME_PRESETS } from '../color/THEME_PRESETS'

/** A profile's colour is one of the theme presets' primaries (brief decision 65). */
export const PROFILE_COLORS: readonly string[] = THEME_PRESETS.map((preset) => preset.primary)
