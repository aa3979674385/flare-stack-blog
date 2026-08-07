import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AssetUploadField } from "@/features/config/components/asset-upload-field";
import { Field } from "@/features/config/components/site-settings-fields";
import { SocialLinksEditor } from "@/features/config/components/social-links-editor";
import type { SystemConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border/30 bg-background/50 overflow-hidden">
      <div className="p-8 space-y-2 border-b border-border/20">
        <h3 className="text-lg font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="p-8 grid gap-8 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function SiteSettingsSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<SystemConfig>();

  const getInputClassName = (error?: string) =>
    error ? "border-destructive focus-visible:border-destructive" : undefined;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <SectionShell
        title={m.settings_site_section_basic_title()}
        description={m.settings_site_section_basic_desc()}
      >
        <Field
          label={m.settings_site_field_title()}
          hint={m.settings_site_field_title_hint()}
          error={errors.site?.title?.message}
        >
          <Input
            {...register("site.title")}
            className={getInputClassName(errors.site?.title?.message)}
            placeholder={m.settings_site_field_title_ph()}
          />
        </Field>
        <Field
          label={m.settings_site_field_author()}
          error={errors.site?.author?.message}
        >
          <Input
            {...register("site.author")}
            className={getInputClassName(errors.site?.author?.message)}
            placeholder={m.settings_site_field_author_ph()}
          />
        </Field>
        <Field
          label={m.settings_site_field_description()}
          hint={m.settings_site_field_description_hint()}
          error={errors.site?.description?.message}
        >
          <Textarea
            {...register("site.description")}
            className={getInputClassName(errors.site?.description?.message)}
            placeholder={m.settings_site_field_description_ph()}
          />
        </Field>
        <Field
          label="文章链接格式"
          hint="决定文章页 URL 形态。切换后全站文章链接会一起变化（无后缀 / .html 后缀 / 按文章 ID），已收录的旧链接仍可正常访问。"
          error={errors.site?.postUrlSuffix?.message}
        >
          <select
            {...register("site.postUrlSuffix")}
            className="flex h-9 w-full rounded-none border-b border-input bg-transparent px-0 py-1 text-sm transition-all focus-visible:outline-hidden focus-visible:border-foreground focus-visible:ring-0"
          >
            <option value="none">无后缀（/post/文章别名）</option>
            <option value="html">.html 后缀（/post/文章别名.html）</option>
            <option value="id">按文章 ID（/post/123.html）</option>
          </select>
        </Field>
      </SectionShell>

      <SectionShell
        title={m.settings_site_section_social_title()}
        description={m.settings_site_section_social_desc()}
      >
        <div className="md:col-span-2">
          <SocialLinksEditor />
        </div>
      </SectionShell>

      <SectionShell
        title={m.settings_site_section_icons_title()}
        description={m.settings_site_section_icons_desc()}
      >
        <AssetUploadField
          name="site.icons.faviconSvg"
          assetPath="favicon/favicon.svg"
          accept=".svg"
          readOnly
          label={m.settings_site_field_favicon_svg()}
          error={errors.site?.icons?.faviconSvg?.message}
        />
        <AssetUploadField
          name="site.icons.faviconIco"
          assetPath="favicon/favicon.ico"
          accept=".ico"
          readOnly
          label={m.settings_site_field_favicon_ico()}
          error={errors.site?.icons?.faviconIco?.message}
        />
        <AssetUploadField
          name="site.icons.favicon96"
          assetPath="favicon/favicon-96x96.png"
          accept=".png"
          readOnly
          label={m.settings_site_field_favicon_96()}
          error={errors.site?.icons?.favicon96?.message}
        />
        <AssetUploadField
          name="site.icons.appleTouchIcon"
          assetPath="favicon/apple-touch-icon.png"
          accept=".png"
          readOnly
          label={m.settings_site_field_apple_touch_icon()}
          error={errors.site?.icons?.appleTouchIcon?.message}
        />
        <AssetUploadField
          name="site.icons.webApp192"
          assetPath="favicon/web-app-manifest-192x192.png"
          accept=".png,.webp"
          readOnly
          label={m.settings_site_field_web_app_192()}
          error={errors.site?.icons?.webApp192?.message}
        />
        <AssetUploadField
          name="site.icons.webApp512"
          assetPath="favicon/web-app-manifest-512x512.png"
          accept=".png,.webp"
          readOnly
          label={m.settings_site_field_web_app_512()}
          error={errors.site?.icons?.webApp512?.message}
        />
      </SectionShell>
    </div>
  );
}
