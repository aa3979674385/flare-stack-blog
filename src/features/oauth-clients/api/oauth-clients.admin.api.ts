import { createServerFn } from "@tanstack/react-start";
import { requirePermission } from "@/lib/middlewares";
import {
  DeleteOAuthConnectionInputSchema,
  RenameOAuthClientInputSchema,
} from "../schema/oauth-client.schema";
import * as OAuthClientService from "../service/oauth-client.service";

export const getOAuthConnectionsFn = createServerFn()
  .middleware([requirePermission("oauth.manage")])
  .handler(({ context }) => OAuthClientService.listOAuthConnections(context));

export const renameOAuthClientFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("oauth.manage")])
  .inputValidator(RenameOAuthClientInputSchema)
  .handler(({ context, data }) =>
    OAuthClientService.renameOAuthClient(context, data),
  );

export const deleteOAuthConnectionFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("oauth.manage")])
  .inputValidator(DeleteOAuthConnectionInputSchema)
  .handler(({ context, data }) =>
    OAuthClientService.deleteOAuthConnection(context, data.consentId),
  );
