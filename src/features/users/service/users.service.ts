import * as UserRepo from "../data/users.data";

export async function listUsers(
  context: DbContext,
  data: UserRepo.ListUsersInput,
) {
  return UserRepo.listUsers(context.db, data);
}

export async function getUser(context: DbContext, id: string) {
  return UserRepo.getUserById(context.db, id);
}

export async function updateUser(
  context: DbContext,
  id: string,
  data: UserRepo.UpdateUserInput,
) {
  return UserRepo.updateUser(context.db, id, data);
}

export async function deleteUser(context: DbContext, id: string) {
  return UserRepo.deleteUser(context.db, id);
}

export async function adjustPoints(
  context: DbContext,
  id: string,
  field: UserRepo.PointField,
  delta: number,
) {
  return UserRepo.adjustPoints(context.db, id, field, delta);
}

export async function recordUserPointTransaction(
  context: DbContext,
  input: UserRepo.CreatePointTxInput,
) {
  return UserRepo.recordPointTransaction(context.db, input);
}

export async function listUserPointTransactions(
  context: DbContext,
  input: UserRepo.ListPointTxInput,
) {
  return UserRepo.listPointTransactions(context.db, input);
}

export async function deletePointTransactions(
  context: DbContext,
  ids: string[],
) {
  return UserRepo.deletePointTransactions(context.db, ids);
}

export async function clearPointTransactions(context: DbContext) {
  return UserRepo.clearPointTransactions(context.db);
}

export async function getCheckInStatus(context: DbContext, userId: string) {
  return UserRepo.getCheckInStatus(context.db, userId);
}

export async function performCheckIn(
  context: DbContext,
  userId: string,
  reward?: number,
) {
  return UserRepo.performCheckIn(context.db, userId, reward);
}

/** 通过一组候选会话 token 判断当前访问者是否处于封禁状态 */
export async function getBanInfoBySessionTokens(
  context: DbContext,
  tokens: string[],
): Promise<UserRepo.BanInfo | null> {
  for (const token of tokens) {
    if (!token) continue;
    const u = await UserRepo.getUserBySessionToken(context.db, token);
    const info = await UserRepo.getBanInfoByUser(u);
    if (info) return info;
  }
  return null;
}

/** 通过邮箱查询封禁信息（用于登录失败但已知邮箱的场景） */
export async function getBanInfoByEmail(
  context: DbContext,
  email: string,
): Promise<UserRepo.BanInfo | null> {
  const u = await UserRepo.getUserByEmail(context.db, email);
  return UserRepo.getBanInfoByUser(u);
}
