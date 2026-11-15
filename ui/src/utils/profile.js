export function profileNames(profile) {
  if (profile?.firstName != null || profile?.lastName != null) {
    return { firstName: (profile.firstName || '').trim(), lastName: (profile.lastName || '').trim() };
  }
  const [firstName = '', ...rest] = (profile?.name || profile?.fullName || '').trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}
export function profileFullName(profile) {
  const { firstName, lastName } = profileNames(profile);
  return [firstName, lastName].filter(Boolean).join(' ');
}
export function profileInitials(profile) {
  const { firstName, lastName } = profileNames(profile);
  return `${Array.from(firstName)[0] || ''}${Array.from(lastName)[0] || ''}`.toUpperCase();
}
