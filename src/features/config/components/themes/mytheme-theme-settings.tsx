import "@/features/theme/themes/mytheme/styles/preview.css";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type ArrayPath,
  type FieldPath,
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { categoriesWithCountAdminQueryOptions } from "@/features/categories/queries";
import { AssetUploadField } from "@/features/config/components/asset-upload-field";
import {
  ColorField,
  Field,
  RangeField,
} from "@/features/config/components/site-settings-fields";
import type { SystemConfig } from "@/features/config/config.schema";
import {
  FUWARI_THEME_HUE_MAX,
  FUWARI_THEME_HUE_MIN,
} from "@/features/config/site-config.schema";
import { PopupSettingsForm } from "@/features/popup/components/popup-settings-form";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

function MythemeHuePreview() {
  const { control } = useFormContext<SystemConfig>();
  const currentHue = useWatch({
    control,
    name: "site.theme.mytheme.primaryHue",
  });
  const previewHue =
    typeof currentHue === "number" && !Number.isNaN(currentHue)
      ? currentHue
      : 250;

  const previewStyle = {
    "--fuwari-hue": String(previewHue),
  } as React.CSSProperties;

  return (
    <div
      className="fuwari-preview rounded-2xl border border-border/40 bg-background/70 p-4 md:col-span-2"
      style={previewStyle}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {m.settings_site_primary_preview_title()}
          </p>
          <p className="text-xs text-muted-foreground">
            {m.settings_site_primary_preview_desc({ hue: String(previewHue) })}
          </p>
        </div>
        <div
          className="h-10 w-10 shrink-0 rounded-xl border border-black/10 shadow-sm"
          style={{ backgroundColor: "var(--fuwari-primary)" }}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="fuwari-card-base rounded-xl border border-black/5 p-4 shadow-sm">
          <div
            className="h-2.5 w-16 rounded-full"
            style={{ backgroundColor: "var(--fuwari-primary)" }}
          />
          <p className="mt-4 text-xs/5 font-medium text-black/45 dark:text-white/45">
            {m.settings_site_primary_preview_card_label()}
          </p>
          <p className="mt-1 text-lg font-semibold text-black/90 dark:text-white/90">
            {m.settings_site_primary_preview_card_title()}
          </p>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            {m.settings_site_primary_preview_card_desc()}
          </p>
        </div>

        <button
          type="button"
          className="fuwari-btn-primary h-11 rounded-xl px-4 text-sm font-semibold shadow-sm active:scale-[0.98]"
        >
          {m.settings_site_primary_preview_btn_primary()}
        </button>

        <button
          type="button"
          className="fuwari-btn-regular h-11 rounded-xl px-4 text-sm font-medium shadow-sm active:scale-[0.98]"
        >
          {m.settings_site_primary_preview_btn_tinted()}
        </button>
      </div>
    </div>
  );
}

function RecentPostsLimitField() {
  const {
    control,
    formState: { errors },
  } = useFormContext<SystemConfig>();
  const { field } = useController({
    control,
    name: "site.theme.mytheme.recentPostsLimit" as FieldPath<SystemConfig>,
  });
  // 本地草稿：受控 number 清空会被回填默认值(24)，用草稿字符串保留「临时清空」状态，
  // 这样无论底层值怎么变，输入框都按用户实际输入显示（空就是空，不会弹回 24）。
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const display =
    draft !== undefined
      ? draft
      : typeof field.value === "number"
        ? String(field.value)
        : "";

  return (
    <Field
      label="首页文章显示数量"
      hint="设置首页最多显示多少篇文章（1-100，留空则用主题默认 24）"
      error={
        errors.site?.theme?.mytheme?.recentPostsLimit?.message as
          | string
          | undefined
      }
    >
      <input
        ref={field.ref}
        type="number"
        min={1}
        max={100}
        value={display}
        onBlur={field.onBlur}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          field.onChange(v === "" ? undefined : Number(v));
        }}
        className="w-24 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
      />
    </Field>
  );
}

function HomeCategoryTabRow({
  index,
  categories,
  onRemove,
  errors,
}: {
  index: number;
  categories: Array<{ id: number; name: string }>;
  onRemove: () => void;
  errors?: { categoryId?: string; postLimit?: string; label?: string };
}) {
  const { control } = useFormContext<SystemConfig>();
  const categoryField = useController({
    control,
    name: `site.theme.mytheme.homeCategoryTabs.${index}.categoryId` as FieldPath<SystemConfig>,
  });
  const labelField = useController({
    control,
    name: `site.theme.mytheme.homeCategoryTabs.${index}.label` as FieldPath<SystemConfig>,
  });
  const postLimitField = useController({
    control,
    name: `site.theme.mytheme.homeCategoryTabs.${index}.postLimit` as FieldPath<SystemConfig>,
  });
  // 本地草稿：与 RecentPostsLimitField 同款修复，避免清空被回填默认值(24)
  const [postLimitDraft, setPostLimitDraft] = useState<string | undefined>(
    undefined,
  );

  const catId =
    typeof categoryField.field.value === "number"
      ? categoryField.field.value
      : 0;
  const lbl =
    typeof labelField.field.value === "string" ? labelField.field.value : "";

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-3 md:col-span-2">
      <div className="grid gap-3 md:grid-cols-[2fr_1.2fr_0.8fr_auto] md:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            分类
          </label>
          <select
            ref={categoryField.field.ref}
            value={catId || ""}
            onBlur={categoryField.field.onBlur}
            onChange={(e) => {
              const v = e.target.value;
              categoryField.field.onChange(v === "" ? undefined : Number(v));
            }}
            className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
          >
            <option value="">— 请选择分类 —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            自定义显示名（可选）
          </label>
          <input
            ref={labelField.field.ref}
            type="text"
            maxLength={30}
            value={lbl}
            onBlur={labelField.field.onBlur}
            onChange={(e) => labelField.field.onChange(e.target.value)}
            placeholder="留空则用分类原名"
            className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            文章数（1-100）
          </label>
          <input
            ref={postLimitField.field.ref}
            type="number"
            min={1}
            max={100}
            value={
              postLimitDraft !== undefined
                ? postLimitDraft
                : typeof postLimitField.field.value === "number"
                  ? String(postLimitField.field.value)
                  : ""
            }
            onBlur={postLimitField.field.onBlur}
            onChange={(e) => {
              const v = e.target.value;
              setPostLimitDraft(v);
              postLimitField.field.onChange(v === "" ? undefined : Number(v));
            }}
            className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="删除该分类"
          className="h-10 rounded-lg border border-destructive/30 bg-destructive/5 px-3 text-sm font-medium text-destructive transition hover:bg-destructive/10"
        >
          删除
        </button>
      </div>

      {errors?.categoryId ? (
        <p className="mt-2 text-xs text-destructive">
          请选择分类（{errors.categoryId}）
        </p>
      ) : null}
    </div>
  );
}

function HomeCategoryTabsField() {
  const {
    control,
    formState: { errors },
  } = useFormContext<SystemConfig>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "site.theme.mytheme.homeCategoryTabs" as ArrayPath<SystemConfig>,
  });
  const { data: cats = [] } = useQuery(categoriesWithCountAdminQueryOptions());

  const arrayErrors = errors.site?.theme?.mytheme?.homeCategoryTabs;
  const categoryOptionList = cats.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <Field
      label="首页分类标签"
      hint="选择要在首页 tab 里显示哪些分类，可单独设置每个分类显示多少篇文章。不填则首页只显示'最新发布'。"
    >
      <div className="flex flex-col gap-3 md:col-span-2">
        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 px-4 py-6 text-center text-xs text-muted-foreground">
            暂无分类标签，点击下方按钮添加
          </div>
        ) : (
          fields.map((f, i) => (
            <HomeCategoryTabRow
              key={f.id}
              index={i}
              categories={categoryOptionList}
              onRemove={() => remove(i)}
              errors={Array.isArray(arrayErrors) ? arrayErrors[i] : undefined}
            />
          ))
        )}
        <div>
          <button
            type="button"
            onClick={() =>
              append({ categoryId: undefined, label: "", postLimit: 24 })
            }
            disabled={categoryOptionList.length === 0}
            className="fuwari-btn-regular h-10 rounded-xl px-4 text-sm font-medium shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + 添加分类标签
          </button>
          {categoryOptionList.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              还没有分类，请先到「分类」页面创建。
            </p>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

export function MythemeHomeTemplateSettings() {
  const {
    formState: { errors },
  } = useFormContext<SystemConfig>();

  return (
    <>
      {/* 卡片：主题配色 */}
      <div className="rounded-xl border border-border/20 bg-background/60 p-6">
        <div className="border-b border-border/10 pb-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">主题配色</h3>
        </div>
        <RangeField
          name="site.theme.mytheme.primaryHue"
          label={m.settings_site_field_primary_hue()}
          hint={m.settings_site_field_primary_hue_hint()}
          min={FUWARI_THEME_HUE_MIN}
          max={FUWARI_THEME_HUE_MAX}
          step={1}
          unit="deg"
          defaultValue={250}
          error={errors.site?.theme?.mytheme?.primaryHue?.message}
        />
        <div className="mt-4">
          <MythemeHuePreview />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <ColorField
            name="site.theme.mytheme.footerBgLight"
            label="页脚背景色（亮色模式）"
            hint="站点在亮色/白天模式下页脚区域的背景色，支持十六进制颜色或 rgba()。"
            error={errors.site?.theme?.mytheme?.footerBgLight?.message}
          />
          <ColorField
            name="site.theme.mytheme.footerBgDark"
            label="页脚背景色（暗色模式）"
            hint="站点在暗色/夜间模式下页脚区域的背景色，建议用半透明白色（如 rgba(255,255,255,0.04)）。"
            error={errors.site?.theme?.mytheme?.footerBgDark?.message}
          />
        </div>
      </div>

      {/* 卡片：首页视觉 */}
      <div className="rounded-xl border border-border/20 bg-background/60 p-6">
        <div className="border-b border-border/10 pb-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">首页视觉</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <AssetUploadField
            name="site.theme.mytheme.homeBg"
            assetPath="themes/mytheme/home-bg.webp"
            accept=".png,.webp,.jpg,.jpeg"
            label={m.settings_site_field_home_image()}
            hint={m.settings_site_field_home_image_hint()}
            placeholder="/images/asset/themes/mytheme/home-bg.webp or https://picsum.photos/1600/900"
            error={errors.site?.theme?.mytheme?.homeBg?.message}
          />
          <AssetUploadField
            name="site.theme.mytheme.avatar"
            assetPath="themes/mytheme/avatar.png"
            accept=".png,.webp,.jpg,.jpeg"
            readOnly
            label={m.settings_site_field_avatar()}
            error={errors.site?.theme?.mytheme?.avatar?.message}
          />
        </div>
      </div>
    </>
  );
}

function HomeCategoryStyleField() {
  const { control } = useFormContext<SystemConfig>();
  const { field } = useController({
    control,
    name: "site.theme.mytheme.homeCategoryStyle" as FieldPath<SystemConfig>,
  });

  const value = field.value === "stacked" ? "stacked" : "tabs";
  const options: Array<{
    value: "tabs" | "stacked";
    label: string;
    desc: string;
  }> = [
    {
      value: "tabs",
      label: "标签切换式",
      desc: "顶部一排分类标签，点哪个就显示哪个分类的文章（默认）",
    },
    {
      value: "stacked",
      label: "垂直堆叠式",
      desc: "最新发布 + 各分类依次向下堆叠成多个区块，每块独立翻页",
    },
  ];

  return (
    <Field
      label="首页分类展示样式"
      hint="选择首页分类区域的布局方式，可在两种样式间切换"
    >
      <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => field.onChange(opt.value)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition",
                active
                  ? "border-(--fuwari-primary) bg-(--fuwari-primary)/10 ring-1 ring-(--fuwari-primary)"
                  : "border-border/40 bg-background/40 hover:border-(--fuwari-primary)/50",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    active ? "border-(--fuwari-primary)" : "border-border/60",
                  )}
                >
                  {active ? (
                    <span className="h-2 w-2 rounded-full bg-(--fuwari-primary)" />
                  ) : null}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {opt.label}
                </span>
              </div>
              <p className="mt-1.5 pl-6 text-xs text-muted-foreground">
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function MythemeHomeSettings() {
  return (
    <>
      {/* 卡片：文章列表 */}
      <div className="rounded-xl border border-border/20 bg-background/60 p-6">
        <div className="border-b border-border/10 pb-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">文章列表</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <RecentPostsLimitField />
          <HomeCategoryStyleField />
        </div>
      </div>

      {/* 卡片：分类标签 */}
      <div className="rounded-xl border border-border/20 bg-background/60 p-6">
        <div className="border-b border-border/10 pb-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">分类标签</h3>
        </div>
        <HomeCategoryTabsField />
      </div>
    </>
  );
}

export function MythemeDetailSettings() {
  const { register } = useFormContext<SystemConfig>();

  return (
    <div className="rounded-xl border border-border/20 bg-background/60 p-6">
      <div className="border-b border-border/10 pb-3 mb-5">
        <h3 className="text-sm font-semibold text-foreground">版权声明</h3>
      </div>
      <Field
        label="文章版权声明"
        hint="显示在每篇文章底部的版权声明，支持 HTML。留空则不显示。例如：&lt;p&gt;本文由 &lt;strong&gt;站点名称&lt;/strong&gt; 原创发布，转载请注明出处。&lt;/p&gt;"
      >
        <textarea
          {...register("site.theme.mytheme.copyrightNotice")}
          rows={5}
          placeholder="输入 HTML 内容，如：<p>版权声明文字</p>"
          className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary) resize-y"
        />
      </Field>
    </div>
  );
}

export function MythemeCategorySettings() {
  return (
    <div className="rounded-xl border border-dashed border-border/40 px-4 py-10 text-center text-sm text-muted-foreground">
      分类页相关设置即将开放，后续会在这里配置分类列表页的展示样式。
    </div>
  );
}

const TOOLBAR_BUTTON_TYPES = [
  { value: "qq", label: "QQ" },
  { value: "qqmail", label: "QQ邮箱" },
  { value: "qqgroup", label: "QQ群" },
  { value: "wechat", label: "微信" },
  { value: "link", label: "自定义链接" },
  { value: "image", label: "图片" },
] as const;

type ToolbarButtonType = (typeof TOOLBAR_BUTTON_TYPES)[number]["value"];

function createToolbarButton(): {
  id: string;
  name: string;
  type: ToolbarButtonType;
  icon: string;
  value: string;
  enabled: boolean;
  order: number;
} {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `btn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: "",
    type: "qq",
    icon: "",
    value: "",
    enabled: true,
    order: 0,
  };
}

export function MythemeOtherSettings() {
  const { register, control, watch, setValue } = useFormContext<SystemConfig>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "site.theme.mytheme.floatingToolbar.buttons" as ArrayPath<SystemConfig>,
  });

  const base = "site.theme.mytheme.floatingToolbar";
  const enabled = watch(`${base}.enabled`) ?? true;
  const showThemeToggle = watch(`${base}.showThemeToggle`) ?? true;
  const showBackToTop = watch(`${base}.showBackToTop`) ?? true;
  const fixedMode = (watch(`${base}.fixedMode`) ?? "fixed") as
    | "fixed"
    | "scroll";

  const setBool = (name: string, checked: boolean) =>
    setValue(name as FieldPath<SystemConfig>, checked, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

  return (
    <div className="space-y-6">
      {/* 卡片：悬浮工具栏 */}
      <div className="rounded-xl border border-border/20 bg-background/60 p-6">
        <div className="border-b border-border/10 pb-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">悬浮工具栏</h3>
        </div>

        {/* 总开关 */}
        <label className="flex items-center gap-4 rounded-lg border border-border/20 bg-muted/10 p-4 cursor-pointer hover:bg-muted/20 transition-colors">
          <Checkbox
            checked={enabled}
            onCheckedChange={(c) => setBool(`${base}.enabled`, c)}
          />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              启用右侧悬浮工具栏
            </p>
            <p className="text-xs text-muted-foreground">
              关闭后，站点右侧整组悬浮按钮（含黑白切换、回到顶部、自定义按钮）将全部不显示。
            </p>
          </div>
        </label>

        {/* 内置按钮开关 */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-4 rounded-lg border border-border/20 bg-muted/10 p-4 cursor-pointer hover:bg-muted/20 transition-colors">
            <Checkbox
              checked={showThemeToggle}
              onCheckedChange={(c) => setBool(`${base}.showThemeToggle`, c)}
            />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                显示黑白模式切换
              </p>
              <p className="text-xs text-muted-foreground">
                复用站点已有明暗主题，点击在亮色/暗色间切换。
              </p>
            </div>
          </label>

          <label className="flex items-center gap-4 rounded-lg border border-border/20 bg-muted/10 p-4 cursor-pointer hover:bg-muted/20 transition-colors">
            <Checkbox
              checked={showBackToTop}
              onCheckedChange={(c) => setBool(`${base}.showBackToTop`, c)}
            />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                显示回到顶部
              </p>
              <p className="text-xs text-muted-foreground">
                固定在按钮组最底部，点击平滑滚动回页面顶部。
              </p>
            </div>
          </label>
        </div>

        {/* 固定方式 */}
        <div className="mt-5">
          <Field
            label="固定方式"
            hint="常驻固定：工具栏一直显示在右侧；滚动出现：向下滚动一段距离后才滑出。"
          >
            <select
              value={fixedMode}
              onChange={(e) =>
                setValue(
                  `${base}.fixedMode` as FieldPath<SystemConfig>,
                  e.target.value as "fixed" | "scroll",
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  },
                )
              }
              className="h-11 w-full max-w-xs rounded-lg border border-border/50 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/60"
            >
              <option value="fixed">常驻固定</option>
              <option value="scroll">滚动出现</option>
            </select>
          </Field>
        </div>
      </div>

      {/* 卡片：自定义按钮 */}
      <div className="rounded-xl border border-border/20 bg-background/60 p-6">
        <div className="border-b border-border/10 pb-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">自定义按钮</h3>
          <p className="text-xs text-muted-foreground mt-1">
            可添加 QQ、QQ邮箱、QQ群、微信、自定义链接、图片等悬浮按钮。
          </p>
        </div>
        <div className="space-y-4">
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/40 bg-muted/5 p-8 text-center text-sm text-muted-foreground">
              暂无自定义按钮，点击下方「添加按钮」开始添加。
            </div>
          ) : (
            fields.map((f, index) => {
              const type = (watch(`${base}.buttons.${index}.type`) ??
                "qq") as ToolbarButtonType;
              const isImage = type === "wechat" || type === "image";
              const buttonEnabled =
                watch(`${base}.buttons.${index}.enabled`) ?? true;
              return (
                <div
                  key={f.id}
                  className="rounded-xl border border-border/30 bg-muted/5 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      按钮 #{index + 1}
                    </p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                        <Checkbox
                          checked={buttonEnabled}
                          onCheckedChange={(c) =>
                            setBool(`${base}.buttons.${index}.enabled`, c)
                          }
                        />
                        启用
                      </label>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={13} />
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-foreground">
                        名称
                      </p>
                      <Input
                        {...register(`${base}.buttons.${index}.name`)}
                        placeholder="如：联系QQ、我的微信"
                        className="h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-foreground">
                        类型
                      </p>
                      <select
                        {...register(`${base}.buttons.${index}.type`)}
                        className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/60"
                      >
                        {TOOLBAR_BUTTON_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <AssetUploadField
                      name={`${base}.buttons.${index}.icon`}
                      assetPath="floating-toolbar"
                      accept="image/*"
                      label="图标（可选）"
                      hint="留空则使用类型默认图标"
                      placeholder="/images/asset/floating-toolbar"
                    />
                    {isImage ? (
                      <AssetUploadField
                        name={`${base}.buttons.${index}.value`}
                        assetPath="floating-toolbar"
                        accept="image/*"
                        label="图片 / 二维码"
                        hint="鼠标悬停按钮时展示该图"
                        placeholder="/images/asset/floating-toolbar"
                      />
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground">
                          值（QQ号 / 邮箱前缀 / 群链接 / 网址）
                        </p>
                        <Input
                          {...register(`${base}.buttons.${index}.value`)}
                          placeholder={
                            type === "qq"
                              ? "QQ号，如 123456789"
                              : type === "qqmail"
                                ? "QQ号前缀，如 123456789"
                                : type === "qqgroup"
                                  ? "QQ群加群链接"
                                  : "https://example.com"
                          }
                          className="h-10 rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-foreground">
                      排序（数字越小越靠上）
                    </p>
                    <Input
                      type="number"
                      {...register(`${base}.buttons.${index}.order`, {
                        valueAsNumber: true,
                      })}
                      className="h-10 w-32 rounded-lg"
                    />
                  </div>
                </div>
              );
            })
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => append(createToolbarButton())}
            className="h-10 px-6 rounded-lg text-[10px] font-mono uppercase tracking-[0.2em]"
          >
            <Plus size={12} className="mr-3" />
            添加按钮
          </Button>
        </div>
      </div>

      {/* 卡片：弹窗通知 */}
      <div className="rounded-xl border border-border/20 bg-background/60 p-6">
        <div className="border-b border-border/10 pb-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">弹窗通知</h3>
        </div>
        <PopupSettingsForm />
      </div>
    </div>
  );
}
