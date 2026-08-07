import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { popupConfigQueryOptions } from "@/features/popup/queries";
import { savePopupConfigFn } from "@/features/popup/api/popup.admin.api";
import {
  DEFAULT_POPUP_CONFIG,
  POPUP_POLICIES,
  POPUP_POLICY_LABELS,
  POPUP_SIZES,
  POPUP_SIZE_LABELS,
  POPUP_TITLE_STYLES,
  POPUP_TITLE_STYLE_LABELS,
  POPUP_HEADER_CLASSES,
  POPUP_HEADER_CLASS_LABELS,
  POPUP_HEADER_GRADIENT,
  POPUP_BUTTON_COLORS,
  POPUP_BUTTON_COLOR_LABELS,
  type PopupConfig,
  type PopupButton,
} from "@/features/popup/popup.schema";

const inputClass =
  "w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-foreground/60";

/**
 * 弹窗通知设置表单。原独立页面（/admin/popup）已并入「模板设置」，
 * 此处抽出为可复用组件，由模板设置页渲染。
 */
export function PopupSettingsForm() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(popupConfigQueryOptions());
  const [form, setForm] = useState<PopupConfig>(DEFAULT_POPUP_CONFIG);
  const [saving, setSaving] = useState(false);
  // 数字输入框草稿：受控 number 清空会被强制成 0，用本地草稿字符串区分「临时清空」与「值 0」
  const [numDraft, setNumDraft] = useState<
    Partial<Record<"width" | "delayMs" | "expiresHours", string>>
  >({});

  // 仅在首次拿到 data 时同步进表单；后续后台 refetch 不再覆盖正在编辑的内容
  const didInitForm = useRef(false);
  useEffect(() => {
    if (data && !didInitForm.current) {
      didInitForm.current = true;
      setForm({ ...DEFAULT_POPUP_CONFIG, ...data });
      setNumDraft({});
    }
  }, [data]);

  const update = <K extends keyof PopupConfig>(
    key: K,
    value: PopupConfig[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  // 数字输入框：value 优先用草稿（允许临时为空），onChange 同步草稿并把空值归一为 0
  const numField = (k: "width" | "delayMs" | "expiresHours") => ({
    value: numDraft[k] !== undefined ? numDraft[k] : String(form[k]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setNumDraft((d) => ({ ...d, [k]: v }));
      update(k, v === "" ? 0 : Number(v));
    },
  });

  const onSave = async () => {
    setSaving(true);
    try {
      await savePopupConfigFn({ data: form });
      toast.success("弹窗设置已保存");
      queryClient.invalidateQueries({ queryKey: ["popup", "config"] });
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  /* ---- 按钮组编辑 ---- */
  const updateButton = (i: number, patch: Partial<PopupButton>) =>
    setForm((f) => ({
      ...f,
      buttons: f.buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    }));
  const addButton = () =>
    setForm((f) =>
      f.buttons.length >= 4
        ? f
        : { ...f, buttons: [...f.buttons, { text: "", link: "", color: "c-blue" }] },
    );
  const removeButton = (i: number) =>
    setForm((f) => ({ ...f, buttons: f.buttons.filter((_, idx) => idx !== i) }));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={16} /> 加载中…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <div className="flex items-center justify-between border-b border-border/30 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-serif font-medium tracking-tight text-foreground">
            弹窗通知
          </h1>
          <p className="text-sm text-muted-foreground">
            仿子比主题弹窗通知：用户打开网站自动弹出模态框（支持炫彩标题、HTML 内容、多个彩色按钮）。
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex h-11 items-center gap-2 rounded-none bg-foreground px-8 font-mono text-[11px] uppercase tracking-[0.2em] text-background transition-all hover:bg-foreground/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {saving ? "保存中" : "保存"}
        </button>
      </div>

      <Field label="启用弹窗通知" hint="关闭后前台不再自动弹出。">
        <Toggle checked={form.enabled} onChange={(v) => update("enabled", v)} />
      </Field>

      <Field label="显示策略" hint="控制哪些用户不显示弹窗（对应子比弹窗策略）。">
        <select
          value={form.policy}
          onChange={(e) => update("policy", e.target.value as PopupConfig["policy"])}
          className={inputClass}
        >
          {POPUP_POLICIES.map((p) => (
            <option key={p} value={p}>
              {POPUP_POLICY_LABELS[p]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="窗口尺寸">
        <select
          value={form.size}
          onChange={(e) => update("size", e.target.value as PopupConfig["size"])}
          className={inputClass}
        >
          {POPUP_SIZES.map((s) => (
            <option key={s} value={s}>
              {POPUP_SIZE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="自定义宽度(px)"
        hint="填写后覆盖上方「窗口尺寸」；留空或 0 则按窗口尺寸预设。建议 280–960。"
      >
        <input
          type="number"
          min={0}
          max={1200}
          {...numField("width")}
          placeholder="0 = 按窗口尺寸"
          className={inputClass}
        />
      </Field>

      <Field label="标题显示样式">
        <select
          value={form.titleStyle}
          onChange={(e) => update("titleStyle", e.target.value as PopupConfig["titleStyle"])}
          className={inputClass}
        >
          {POPUP_TITLE_STYLES.map((s) => (
            <option key={s} value={s}>
              {POPUP_TITLE_STYLE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>

      {form.titleStyle === "colorful" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field label="标题文字">
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="例如：主题模板推荐"
              className={inputClass}
            />
          </Field>
          <Field label="标题图标" hint="可选：heart/star/gift/bell/info/crown/sparkles/zap/smile/rocket/mail/send/tag/award/megaphone/thumbs-up，默认 heart。">
            <input
              type="text"
              value={form.titleIcon}
              onChange={(e) => update("titleIcon", e.target.value)}
              placeholder="heart"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {form.titleStyle === "colorful" && (
        <Field label="标题背景主题" hint="炫彩头部渐变色（对应子比 jb-* 配色）。">
          <div className="flex flex-wrap gap-2">
            {POPUP_HEADER_CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update("headerClass", c)}
                className={
                  "rounded-md px-3 py-2 text-xs font-medium text-white transition " +
                  (form.headerClass === c
                    ? "ring-2 ring-foreground ring-offset-2"
                    : "opacity-80 hover:opacity-100")
                }
                style={{ background: POPUP_HEADER_GRADIENT[c] }}
              >
                {POPUP_HEADER_CLASS_LABELS[c]}
              </button>
            ))}
          </div>
        </Field>
      )}

      {form.titleStyle === "default" && (
        <Field label="标题文字">
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="可选，留空则不显示标题"
            className={inputClass}
          />
        </Field>
      )}

      <Field label="弹窗内容" hint="支持 HTML，可插入图片、链接等。">
        <textarea
          value={form.content}
          onChange={(e) => update("content", e.target.value)}
          rows={6}
          placeholder={'<p class="c-yellow">欢迎访问本站</p>'}
          className={`${inputClass} font-mono text-xs`}
        />
      </Field>

      {/* 按钮组（最多 4 个，每个：文字 + 链接 + 颜色） */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">弹窗按钮</label>
          <button
            type="button"
            onClick={addButton}
            disabled={form.buttons.length >= 4}
            className="flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 text-xs text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <Plus size={14} /> 添加按钮（最多 4 个）
          </button>
        </div>
        {form.buttons.map((btn, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-3 rounded-lg border border-border/30 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
          >
            <input
              type="text"
              value={btn.text}
              onChange={(e) => updateButton(i, { text: e.target.value })}
              placeholder="按钮文字"
              className={inputClass}
            />
            <input
              type="text"
              value={btn.link}
              onChange={(e) => updateButton(i, { link: e.target.value })}
              placeholder="按钮链接 https://..."
              className={inputClass}
            />
            <select
              value={btn.color}
              onChange={(e) =>
                updateButton(i, { color: e.target.value as PopupButton["color"] })
              }
              className={inputClass}
            >
              {POPUP_BUTTON_COLORS.map((c) => (
                <option key={c} value={c}>
                  {POPUP_BUTTON_COLOR_LABELS[c]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeButton(i)}
              className="flex items-center justify-center rounded-md border border-border/40 px-3 text-muted-foreground transition hover:bg-muted hover:text-red-500"
              aria-label="删除按钮"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {form.buttons.length === 0 && (
          <p className="text-xs text-muted-foreground">未添加按钮，前台不显示按钮区。</p>
        )}
      </div>

      <Field label="按钮圆角显示">
        <Toggle
          checked={form.buttonRadius}
          onChange={(v) => update("buttonRadius", v)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="延迟弹出(毫秒)" hint="页面加载后多久弹出，默认 500ms。">
          <input
            type="number"
            min={0}
            max={60000}
            {...numField("delayMs")}
            className={inputClass}
          />
        </Field>
        <Field
          label="弹窗周期(小时)"
          hint="多少小时内不重复弹出（0 = 每次刷新都弹）。"
        >
          <input
            type="number"
            min={0}
            max={2000}
            {...numField("expiresHours")}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="显示关闭按钮">
          <Toggle
            checked={form.showClose}
            onChange={(v) => update("showClose", v)}
          />
        </Field>
        <Field label="点击遮罩关闭">
          <Toggle
            checked={form.maskCloseable}
            onChange={(v) => update("maskCloseable", v)}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span className="text-sm text-foreground">{checked ? "开启" : "关闭"}</span>
    </label>
  );
}
