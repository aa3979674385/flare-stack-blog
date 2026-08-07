import { Check } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import type { AuthMethod, SystemConfig } from "@/features/config/config.schema";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AuthMethod; title: string; desc: string }[] = [
  {
    value: "email",
    title: "仅邮箱注册",
    desc: "访客使用「邮箱 + 密码」注册登录。需先在「邮件服务」中配置 SMTP 发信。",
  },
  {
    value: "oauth",
    title: "仅第三方登录",
    desc: "访客使用 GitHub OAuth 登录。需在环境变量中配置 GITHUB_CLIENT_ID 与 GITHUB_CLIENT_SECRET。",
  },
  {
    value: "both",
    title: "全部开启",
    desc: "同时开放邮箱注册与 GitHub 第三方登录。",
  },
];

export function AuthSettingsSection() {
  const { control } = useFormContext<SystemConfig>();

  return (
    <section className="border border-border/30 bg-background/50 overflow-hidden">
      <div className="p-8 space-y-2 border-b border-border/20">
        <h3 className="text-lg font-medium text-foreground">登录方式</h3>
        <p className="text-sm text-muted-foreground">
          配置访客注册与登录本站点的方式。修改后点击右上角「保存」即可生效。
        </p>
      </div>
      <div className="p-8">
        <Controller
          control={control}
          name="auth.methods"
          render={({ field }) => {
            const current = (field.value ?? "email") as AuthMethod;
            return (
              <div className="grid gap-4 md:grid-cols-3">
                {OPTIONS.map((opt) => {
                  const active = current === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => field.onChange(opt.value)}
                      className={cn(
                        "text-left rounded-xl border p-5 transition-all",
                        active
                          ? "border-foreground bg-muted/40"
                          : "border-border/40 hover:border-foreground/40",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {opt.title}
                        </span>
                        {active && <Check size={16} className="text-foreground" />}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          }}
        />

        <div className="mt-8 border-t border-border/20 pt-8">
          <Controller
            control={control}
            name="auth.requireEmailVerification"
            render={({ field }) => {
              const checked = field.value ?? true;
              return (
                <div className="flex items-start justify-between gap-6">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      注册时要求验证邮箱
                    </p>
                    <p className="text-sm text-muted-foreground">
                      开启后，新用户注册必须完成邮箱验证才能登录；关闭后，注册成功即可直接登录（无需验证邮件，可不配置 SMTP 发信）。
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() => field.onChange(!checked)}
                    className={cn(
                      "mt-1 shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      checked ? "bg-foreground" : "bg-border",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-background transition-transform",
                        checked ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}
