/**
 * ✅ ตรวจสิทธิ: ผู้ใช้ต้องมียศ allowed_role_id
 * - rolesCache: interaction.member.roles.cache
 */
export function hasAllowedRole(member, allowedRoleId) {
  if (!allowedRoleId) return false;
  if (!member?.roles?.cache) return false;
  return member.roles.cache.has(String(allowedRoleId));
}
