export type RoleBase = 'category' | 'response-topic' | 'intention' | 'source' | 'highlight';
export type RolesMap = {
  roleBase: RoleBase;
  itemRole: string;
  headRole: string;
  tailRole: string;
  prevRole: string;
  shadowRole: string;
  memberRoles: string[];
  allRoles: string[];
};

export function getRolesFromRoleBase(roleBase: RoleBase): RolesMap {
  let itemRole = roleBase + '-item';
  let headRole = roleBase + '-head';
  let tailRole = roleBase + '-tail';
  let prevRole = roleBase + '-prev';
  let shadowRole = roleBase + '-shadow';
  return {
    roleBase,
    itemRole,
    headRole,
    tailRole,
    prevRole,
    shadowRole,
    memberRoles: [headRole, itemRole, tailRole],
    allRoles: [headRole, tailRole, itemRole, prevRole, shadowRole],
  };
}
