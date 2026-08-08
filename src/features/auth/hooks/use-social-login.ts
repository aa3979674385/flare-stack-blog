import { useState } from "react";
import { toast } from "sonner";
import { usePreviousLocation } from "@/hooks/use-previous-location";
import { authClient } from "@/lib/auth/auth.client";
import { getSocialLoginAuthErrorMessage } from "@/lib/auth/auth-errors";
import { m } from "@/paraglide/messages";
import { normalizeRedirectUrl } from "./normalize-redirect-url";

export interface UseSocialLoginOptions {
  redirectTo?: string;
}

export function useSocialLogin(options: UseSocialLoginOptions) {
  const { redirectTo } = options;

  const [isLoading, setIsLoading] = useState(false);
  const previousLocation = usePreviousLocation();

  const handleGithubLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);

    // 注意：normalizeRedirectUrl 依赖 window.location，必须在点击回调里惰性计算。
    // 之前它在组件渲染期（hook body）被调用，导致 SSR 时抛 "window is not defined"，
    // React 把整个登录页 Suspense 边界标记为出错（<!--$!-->），客户端只能整棵子树
    // 重新渲染 → 登录页固定报水合错误 #419。
    const callbackURL = normalizeRedirectUrl(redirectTo, previousLocation);

    const { error } = await authClient.signIn.social({
      provider: "github",
      errorCallbackURL: `${window.location.origin}/login`,
      callbackURL,
    });

    if (error) {
      toast.error(m.login_toast_social_failed(), {
        description:
          getSocialLoginAuthErrorMessage(error, m) ??
          m.auth_error_default_desc(),
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  };

  return {
    isLoading,
    turnstilePending: false,
    handleGithubLogin,
  };
}

export type UseSocialLoginReturn = ReturnType<typeof useSocialLogin>;
