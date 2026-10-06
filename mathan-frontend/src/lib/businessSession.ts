import { Membership } from '../types';

export function resolveSelectedBusinessId(storedBusinessId: string | null, memberships: Membership[]): string | null {
  if (!storedBusinessId) return null;
  return memberships.some(membership => membership.businessId === storedBusinessId) ? storedBusinessId : null;
}
