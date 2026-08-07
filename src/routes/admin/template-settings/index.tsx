import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { FormProvider, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionSkeleton } from "@/features/config/components/settings-skeleton";
import { TemplateSettingsPage } from "@/features/config/components/template-settings-page";
import {
  createSystemConfigFormSchema,
  DEFAULT_CONFIG,
  type SystemConfig,
} from "@/features/config/config.schema";
import { useSystemSetting } from "@/features/config/hooks/use-system-setting";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/template-settings/")({
  ssr: "data-only",
  component: RouteComponent,
  loader: () => ({ title: "模板设置" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function RouteComponent() {
  const { settings, saveSettings, isLoading } = useSystemSetting();
  const formRef = useRef<HTMLFormElement>(null);
  const methods = useForm<SystemConfig>({
    resolver: zodResolver(
      createSystemConfigFormSchema(m),
    ) as unknown as Resolver<SystemConfig>,
    defaultValues: DEFAULT_CONFIG,
  });
  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  // 仅在首次拿到 settings 时把服务端配置同步进表单；
  // 后续后台 refetch（如窗口聚焦自动刷新）不再 reset，避免把正在编辑的内容打回旧值（数字框清空后会变回默认值 24）
  const didInitForm = useRef(false);
  useEffect(() => {
    if (settings && !didInitForm.current) {
      didInitForm.current = true;
      reset({
        ...DEFAULT_CONFIG,
        ...settings,
        site: { ...DEFAULT_CONFIG.site, ...settings.site },
      });
    }
  }, [settings, reset]);

  const onSubmit = async (data: SystemConfig) => {
    try {
      await saveSettings({ data });
      toast.success(m.settings_toast_save_success());
      // Reset dirty state with new values
      reset(data);
    } catch {
      toast.error(m.settings_toast_save_error());
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-20">
        <SectionSkeleton />
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000"
      >
        {/* Header Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-5 border-b border-border/30">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-foreground">
              模板设置
            </h1>
            <p className="text-sm text-muted-foreground">
              配置当前模板（{__THEME_NAME__}
              ）在首页、详情页、分类页等位置的展示效果。设置仅对当前激活模板生效，切换模板后此处内容会随之变化。
            </p>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="hidden sm:flex h-11 px-8 rounded-none bg-foreground text-background hover:bg-foreground/90 transition-all font-mono text-[11px] uppercase tracking-[0.2em] font-medium disabled:opacity-50 shadow-lg shadow-foreground/5"
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin mr-3" />
            ) : (
              <Check size={14} className="mr-3" />
            )}
            {isSubmitting ? "保存中…" : "保存设置"}
          </Button>
        </div>

        <TemplateSettingsPage />

        {/* Floating Action Button for Mobile */}
        {isDirty && (
          <div className="fixed bottom-8 right-6 z-50 sm:hidden animate-in fade-in zoom-in slide-in-from-bottom-10 duration-500">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-14 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-2xl flex items-center justify-center p-0"
            >
              {isSubmitting ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Check size={24} />
              )}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
