import * as AuthRepo from "@/features/auth/data/auth.data";
import * as ConfigRepo from "@/features/config/data/config.data";
import * as ConfigService from "@/features/config/service/config.service";
import type { AuthMethod } from "@/features/config/config.schema";

export async function getSession(context: SessionContext) {
  return context.session;
}

export async function userHasPassword(context: AuthContext) {
  return await AuthRepo.userHasPassword(context.db, context.session.user.id);
}

export async function getIsEmailConfigured(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const config = await ConfigService.getSystemConfig(context);
  return !!(
    config?.email?.host &&
    config.email.username &&
    config.email.password &&
    config.email.senderAddress
  );
}

export async function getAuthSettings(
  context: DbContext,
): Promise<{ methods: AuthMethod }> {
  const config = await ConfigRepo.getSystemConfig(context.db);
  return { methods: config?.auth?.methods ?? "email" };
}
