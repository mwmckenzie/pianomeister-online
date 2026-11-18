import type { Profile } from './Profile'

/**
 * The profile every device starts with. Its id is fixed: data stored before profiles existed
 * already belongs to it, and two devices' "Me" profiles share an id, so a backup import
 * recognises them as the same profile and asks what to do (brief decision 75).
 */
export const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Me',
  color: '#8AB4FF',
  createdAt: 0,
}
