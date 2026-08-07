import { createServerFn } from "@tanstack/react-start";
import { requirePermission } from "@/lib/middlewares";
import {
  ApproveFriendLinkInputSchema,
  CreateFriendLinkInputSchema,
  DeleteFriendLinkInputSchema,
  GetAllFriendLinksInputSchema,
  RejectFriendLinkInputSchema,
  UpdateFriendLinkInputSchema,
} from "../friend-links.schema";
import * as FriendLinkService from "../friend-links.service";

export const getAllFriendLinksFn = createServerFn()
  .middleware([requirePermission("link.manage")])
  .inputValidator(GetAllFriendLinksInputSchema)
  .handler(
    async ({ data, context }) =>
      await FriendLinkService.getAllFriendLinks(context, data),
  );

export const createFriendLinkFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("link.manage")])
  .inputValidator(CreateFriendLinkInputSchema)
  .handler(
    async ({ data, context }) =>
      await FriendLinkService.createFriendLink(context, data),
  );

export const updateFriendLinkFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("link.manage")])
  .inputValidator(UpdateFriendLinkInputSchema)
  .handler(
    async ({ data, context }) =>
      await FriendLinkService.updateFriendLink(context, data),
  );

export const approveFriendLinkFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("link.manage")])
  .inputValidator(ApproveFriendLinkInputSchema)
  .handler(
    async ({ data, context }) =>
      await FriendLinkService.approveFriendLink(context, data),
  );

export const rejectFriendLinkFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("link.manage")])
  .inputValidator(RejectFriendLinkInputSchema)
  .handler(
    async ({ data, context }) =>
      await FriendLinkService.rejectFriendLink(context, data),
  );

export const deleteFriendLinkFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("link.manage")])
  .inputValidator(DeleteFriendLinkInputSchema)
  .handler(
    async ({ data, context }) =>
      await FriendLinkService.deleteFriendLink(context, data),
  );
