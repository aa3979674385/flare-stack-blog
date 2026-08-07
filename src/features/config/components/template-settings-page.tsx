import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DefaultThemeSettings } from "@/features/config/components/themes/default-theme-settings";
import { FuwariThemeSettings } from "@/features/config/components/themes/fuwari-theme-settings";
import {
  MythemeCategorySettings,
  MythemeDetailSettings,
  MythemeHomeSettings,
  MythemeHomeTemplateSettings,
  MythemeOtherSettings,
} from "@/features/config/components/themes/mytheme-theme-settings";

// 顶部切换按钮（顺序即展示顺序）
const TAB_ITEMS = [
  { value: "home", label: "首页设置" },
  { value: "detail", label: "详情页设置" },
  { value: "category", label: "分类页设置" },
  { value: "other", label: "其他设置" },
] as const;

function OtherThemePlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-border/40 px-4 py-10 text-center text-sm text-muted-foreground">
      当前模板（{__THEME_NAME__}
      ）暂未提供按页面拆分的独立设置，相关配置请在各模板对应的区块中调整。
    </div>
  );
}

// 模板专属：设置跟随当前激活模板（编译期 __THEME_NAME__），切换模板即不显示
function ThemeTabContent({ tab }: { tab: string }) {
  switch (__THEME_NAME__) {
    case "mytheme":
      switch (tab) {
        case "home":
          // 首页模板设置（背景/头像/主色）与首页设置（数量/分类标签）合并展示
          return (
            <>
              <MythemeHomeTemplateSettings />
              <MythemeHomeSettings />
            </>
          );
        case "detail":
          return <MythemeDetailSettings />;
        case "category":
          return <MythemeCategorySettings />;
        case "other":
          return <MythemeOtherSettings />;
        default:
          return null;
      }
    case "default":
    case "fuwari":
      // 其他模板暂不拆分页面设置，统一在「首页设置」展示其原有配置
      if (tab === "home") {
        return __THEME_NAME__ === "default" ? (
          <DefaultThemeSettings />
        ) : (
          <FuwariThemeSettings />
        );
      }
      return <OtherThemePlaceholder />;
    default: {
      __THEME_NAME__ satisfies never;
      return null;
    }
  }
}

export function TemplateSettingsPage() {
  const [activeTab, setActiveTab] = useState<string>("home");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="flex flex-wrap gap-1 border-b border-border/20">
        {TAB_ITEMS.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="text-sm font-medium normal-case tracking-normal px-4 py-2"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {TAB_ITEMS.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-0 space-y-6">
          <div className="space-y-1 pb-4 border-b border-border/20">
            <h2 className="text-xl font-serif font-medium tracking-tight text-foreground">
              {t.label}
            </h2>
            <p className="text-sm text-muted-foreground">
              当前模板（{__THEME_NAME__}）的{t.label}相关配置。
            </p>
          </div>
          <ThemeTabContent tab={t.value} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
