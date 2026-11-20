/**
 * Welcome's greeting (m7-7 decision 5) by local hour: "Good morning" 5–12, "Good afternoon"
 * 12–18, "Good evening" 18–23, "Good night" 23–5, with the profile's name. A profile still named
 * "Me" (the default) is greeted "Welcome back", without a name.
 */
export function greeting(
  hour: number,
  profileName: string,
): { readonly text: string; readonly name: string | null } {
  const name = profileName.trim()
  if (name === '' || name === 'Me') return { text: 'Welcome back', name: null }
  if (hour >= 5 && hour < 12) return { text: 'Good morning', name }
  if (hour >= 12 && hour < 18) return { text: 'Good afternoon', name }
  if (hour >= 18 && hour < 23) return { text: 'Good evening', name }
  return { text: 'Good night', name }
}
