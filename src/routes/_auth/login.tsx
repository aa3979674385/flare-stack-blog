import {
  createFileRoute,
  useLocation,
  useRouteContext,
} from "@tanstack/react-router";
import theme from "@theme";
import { z } from "zod";
import { Turnstile, useTurnstile } from "@/components/common/turnstile";
import { useLoginForm, useSocialLogin } from "@/features/auth/hooks";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: z.object({
    redirectTo: z.string().optional(),
  }),
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: m.login_title(),
      },
    ],
  }),
});

function RouteComponent() {
  const { enableEmail, enableGithub } = useRouteContext({
    from: "/_auth",
  });
  const search = Route.useSearch();
  const location = useLocation();
  const {
    isPending: turnstilePending,
    token: turnstileToken,
    reset: resetTurnstile,
    turnstileProps,
  } = useTurnstile("login");

  const currentSearchParams = new URLSearchParams(
    new URL(location.href, window.location.origin).search,
  );
  const isOAuthAuthorizationRequest =
    !!currentSearchParams.get("client_id") &&
    !!currentSearchParams.get("response_type");

  let resolvedRedirectTo = search.redirectTo;
  if (!resolvedRedirectTo && isOAuthAuthorizationRequest) {
    resolvedRedirectTo = `/oauth/consent?${currentSearchParams.toString()}`;
  }

  const loginForm = useLoginForm({
    turnstileToken,
    turnstilePending,
    resetTurnstile,
    redirectTo: resolvedRedirectTo,
  });

  const socialLogin = useSocialLogin({
    redirectTo: resolvedRedirectTo,
  });

  // Always keep the email form usable so a misconfigured instance
  // (email method enabled but SMTP not configured) is not a blank page.
  const emailVisible = enableEmail || !enableGithub;

  const turnstileElement = emailVisible ? (
    <div className="flex justify-center">
      <Turnstile {...turnstileProps} />
    </div>
  ) : null;

  return (
    <theme.LoginPage
      isEmailConfigured={emailVisible}
      enableEmail={emailVisible}
      enableGithub={enableGithub}
      loginForm={{
        ...loginForm,
        turnstileProps,
        turnstilePending,
      }}
      socialLogin={socialLogin}
      turnstileElement={turnstileElement}
    />
  );
}
