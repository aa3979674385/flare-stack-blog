import { ClientOnly } from "@tanstack/react-router";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreatePostResource,
  useUpdatePostResource,
} from "@/features/post-resources/queries";
import { uploadResourceAttachmentFn } from "@/features/post-resources/api/post-resources.admin.api";
import { parseShareLink } from "@/features/post-resources/lib/share-parse";
import { usePointConfig } from "@/features/config/queries";
import type { PostResource } from "@/lib/db/schema";

const LINK_TYPES = [
  "百度网盘",
  "夸克网盘",
  "阿里云盘",
  "天翼云盘",
  "115网盘",
  "本地附件",
  "其他",
] as const;

interface LinkRow {
  type: string;
  url: string;
  password?: string | null;
}

interface PostResourceModalProps {
  isOpen: boolean;
  postId: number;
  onClose: () => void;
  /** 传入则为编辑模式 */
  resource?: PostResource | null;
}

const EMPTY = {
  title: "",
  extractCode: "",
  links: [{ type: "百度网盘", url: "", password: "" }] as LinkRow[],
  accessType: "free" as "free" | "member" | "paid",
  priceType: "points" as "points" | "credits",
  priceInput: "",
  memberAccess: "none" as "none" | "free" | "required" | "discount",
  memberDiscount: 10,
};

const PostResourceModalInternal = ({
  isOpen,
  postId,
  onClose,
  resource,
}: PostResourceModalProps) => {
  const isEdit = !!resource;
  const create = useCreatePostResource();
  const update = useUpdatePostResource();

  const [title, setTitle] = useState(EMPTY.title);
  const [extractCode, setExtractCode] = useState(EMPTY.extractCode);
  const [hideCodeWhenPaid, setHideCodeWhenPaid] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>(EMPTY.links);
  const [accessType, setAccessType] = useState<"free" | "member" | "paid">(
    EMPTY.accessType,
  );
  const [priceType, setPriceType] = useState<"points" | "credits">(
    EMPTY.priceType,
  );
  const [priceInput, setPriceInput] = useState(EMPTY.priceInput);
  const [memberAccess, setMemberAccess] = useState<
    "none" | "free" | "required" | "discount"
  >(EMPTY.memberAccess);
  const [, setMemberDiscount] = useState(EMPTY.memberDiscount);
  // 编辑态文本：允许自由输入/清空，仅在失焦或提交时校验归一，避免每次按键被钳制
  const [discountText, setDiscountText] = useState(String(EMPTY.memberDiscount));
  // 本地附件上传：pendingUploadIdx 记录当前要填哪一行，uploadingIdx 记录正在上传的行
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pendingUploadIdx, setPendingUploadIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: pointConfig } = usePointConfig();

  useEffect(() => {
    if (!isOpen) return;
    if (resource) {
      setTitle(resource.title);
      setExtractCode(resource.extractCode ?? "");
      setHideCodeWhenPaid(resource.hideCodeWhenPaid === 1);
      setLinks(
        resource.links?.length
          ? resource.links.map((l) => ({
              type: l.type,
              url: l.url,
              password: l.password ?? "",
            }))
          : EMPTY.links,
      );
      setAccessType(resource.accessType);
      setPriceType(resource.priceType);
      setPriceInput(String(resource.priceAmount));
      setMemberAccess(resource.memberAccess);
      const md =
        resource.memberAccess === "discount" ? resource.memberDiscount ?? 10 : 10;
      setMemberDiscount(md);
      setDiscountText(String(md));
    } else {
      setTitle(EMPTY.title);
      setExtractCode(EMPTY.extractCode);
      setHideCodeWhenPaid(false);
      setLinks(EMPTY.links);
      setAccessType(EMPTY.accessType);
      setPriceType(EMPTY.priceType);
      setPriceInput(EMPTY.priceInput);
      setMemberAccess(EMPTY.memberAccess);
      setMemberDiscount(EMPTY.memberDiscount);
      setDiscountText(String(EMPTY.memberDiscount));
    }
  }, [isOpen, resource]);

  if (!isOpen) return null;
  const busy = create.isPending || update.isPending;

  const updateLink = (idx: number, patch: Partial<LinkRow>) => {
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const addLink = () =>
    setLinks((prev) => [...prev, { type: "百度网盘", url: "", password: "" }]);
  const removeLink = (idx: number) =>
    setLinks((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  /** 把完整分享文案拆到一条链接里（链接框 / 提取码框粘贴时复用）。 */
  const applyParsedToRow = (idx: number, raw: string) => {
    const parsed = parseShareLink(raw);
    if (!parsed) return false;
    updateLink(idx, {
      url: parsed.url,
      password: parsed.password ?? "",
      type: parsed.type,
    });
    return true;
  };

  // 在「链接框」粘贴：若是完整分享（含提取码或多余文案），自动拆分到本行
  const handleUrlPaste = (idx: number, e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    const parsed = parseShareLink(text);
    if (parsed && (parsed.password || text.trim() !== parsed.url)) {
      e.preventDefault();
      applyParsedToRow(idx, text);
    }
  };

  // 在「提取码框」粘贴：若粘贴的是完整分享，自动把链接也填回去
  const handlePwdPaste = (idx: number, e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (parseShareLink(text)) {
      e.preventDefault();
      applyParsedToRow(idx, text);
    }
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  // 选择本地文件后上传，成功后把链接自动填入对应行
  const handleAttachmentPick = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同一文件
    const idx = pendingUploadIdx;
    setPendingUploadIdx(null);
    if (!file || idx === null) return;
    setUploadingIdx(idx);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadResourceAttachmentFn({ data: fd });
      updateLink(idx, { url: res.url, type: "本地附件" });
      toast.success(`附件「${res.fileName}」已上传，链接已自动填入`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "附件上传失败");
    } finally {
      setUploadingIdx(null);
    }
  };

  const triggerAttachmentUpload = (idx: number) => {
    setPendingUploadIdx(idx);
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    const cleaned = links
      .map((l) => ({
        type: l.type,
        url: l.url.trim(),
        password: l.password?.trim() || null,
      }))
      .filter((l) => l.url.length > 0);
    if (cleaned.length === 0) {
      toast.error("请至少填写一个有效的网盘链接");
      return;
    }

    let priceAmount = 0;
    if (accessType === "paid") {
      const num = Number(priceInput);
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        toast.error("请输入有效的积分数（整数）");
        return;
      }
      priceAmount = num;
    }

    // 折扣：以编辑态文本为准，失焦时未归一也可在提交时统一校验
    let discountVal = 10;
    if (memberAccess === "discount") {
      const parsed = parseInt(discountText, 10);
      if (!Number.isFinite(parsed)) {
        toast.error("请输入会员折扣系数（1–10 的整数）");
        return;
      }
      discountVal = Math.min(10, Math.max(1, Math.round(parsed)));
    }

    const payload = {
      postId,
      title: title.trim(),
      extractCode: extractCode.trim() || null,
      hideCodeWhenPaid,
      links: cleaned,
      accessType,
      priceType,
      priceAmount,
      memberAccess: accessType === "member" ? "free" : memberAccess,
      memberDiscount: discountVal,
    };

    try {
      if (isEdit && resource) {
        await update.mutateAsync({ data: { id: resource.id, ...payload } });
        toast.success("资源已更新");
      } else {
        await create.mutateAsync({ data: payload });
        toast.success("资源已添加");
      }
      onClose();
    } catch {
      toast.error(isEdit ? "更新失败，请重试" : "添加失败，请重试");
    }
  };

  const selectCls =
    "w-full rounded-none border border-border/40 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground/40";

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />
      <div className="relative bg-background border border-border/30 p-7 max-w-2xl w-full mx-4 animate-in fade-in zoom-in-95 duration-200 shadow-lg max-h-[92vh] overflow-y-auto custom-scrollbar">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-muted-foreground/50 hover:text-foreground transition-colors"
          type="button"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
        <h3 className="text-xl font-serif font-medium mb-1">
          {isEdit ? "编辑下载资源" : "添加下载资源"}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          支持百度网盘等各类网盘链接，可设置免费、会员专享或收费，并配置会员折扣。直接把网盘分享链接（含提取码）粘贴到下方「链接」或「提取码」框即可自动拆分。
        </p>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              资源名称
            </label>
            <Input
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="留空则前台按「下载资源 1/2…」自动显示"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              解压码
            </label>
            <Textarea
              value={extractCode}
              maxLength={500}
              onChange={(e) => setExtractCode(e.target.value)}
              placeholder="压缩包解压密码，如：abc123"
              rows={2}
            />
          </div>

          {/* 收费时隐藏解压码开关 */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideCodeWhenPaid}
              onChange={(e) => setHideCodeWhenPaid(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
            />
            <span className="text-sm">
              收费时隐藏解压码
              <span className="block text-xs text-muted-foreground mt-0.5">
                开启后，若该资源设为「收费」，解压码将对未解锁用户完全隐藏（与收费内容同等保密），仅付费 / 解锁后可见；不开启则正常显示。
              </span>
            </span>
          </label>

          {/* 网盘链接列表 */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              网盘链接 *
            </label>

            {links.map((l, idx) => (
              <div key={idx} className="space-y-2 rounded border border-border/30 p-3">
                <div className="flex items-center gap-2">
                  <select
                    value={l.type}
                    onChange={(e) => updateLink(idx, { type: e.target.value })}
                    className={selectCls}
                  >
                    {LINK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeLink(idx)}
                    disabled={links.length === 1}
                    className="shrink-0 p-2 text-muted-foreground hover:text-red-500 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={l.url}
                    onChange={(e) => updateLink(idx, { url: e.target.value })}
                    onPaste={(e) => handleUrlPaste(idx, e)}
                    placeholder="粘贴完整分享链接即可自动提取（含提取码）"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => triggerAttachmentUpload(idx)}
                    disabled={uploadingIdx === idx}
                    className="shrink-0 flex items-center gap-1 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    {uploadingIdx === idx ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    {uploadingIdx === idx ? "上传中…" : "上传附件"}
                  </button>
                </div>
                <Input
                  value={l.password ?? ""}
                  onChange={(e) => updateLink(idx, { password: e.target.value })}
                  onPaste={(e) => handlePwdPaste(idx, e)}
                  placeholder="提取码（粘贴完整分享也可自动填）"
                />
              </div>
            ))}
            {/* 本地附件上传：选中文件后上传并自动回填链接 */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleAttachmentPick}
            />
            <button
              type="button"
              onClick={addLink}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={12} /> 添加链接
            </button>
          </div>

          {/* 访问类型 */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              访问类型 *
            </label>
            <select
              value={accessType}
              onChange={(e) =>
                setAccessType(e.target.value as "free" | "member" | "paid")
              }
              className={selectCls}
            >
              <option value="free">免费</option>
              <option value="member">会员专享（会员免费查看）</option>
              <option value="paid">收费</option>
            </select>
          </div>

          {/* 收费相关 */}
          {accessType === "paid" && (
            <div className="space-y-4 rounded border border-border/30 p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  积分类型 *
                </label>
                <select
                  value={priceType}
                  onChange={(e) =>
                    setPriceType(e.target.value as "points" | "credits")
                  }
                  className={selectCls}
                >
                  <option value="points">
                    {pointConfig?.pointsName ?? "普通积分"}
                  </option>
                  <option value="credits">
                    {pointConfig?.creditsName ?? "会员积分"}
                  </option>
                </select>
                <p className="text-xs text-muted-foreground">
                  选择该资源用「普通积分」还是「会员积分」结算（双积分体系）。
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  积分数 *
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="如：100"
                />
                <p className="text-xs text-muted-foreground">
                  资源仅以「积分」计价。前台会按后台设置的「积分:人民币」比例自动折算成人民币，供接入支付时使用（系统本身无人民币充值功能）。
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  会员权益
                </label>
                <select
                  value={memberAccess}
                  onChange={(e) =>
                    setMemberAccess(
                      e.target.value as
                        | "none"
                        | "free"
                        | "required"
                        | "discount",
                    )
                  }
                  className={selectCls}
                >
                  <option value="none">无（会员同价）</option>
                  <option value="free">会员免费（普通用户按基础积分数）</option>
                  <option value="discount">会员折扣（自定义 1-10 折）</option>
                  <option value="required">仅会员可购买</option>
                </select>
                {memberAccess === "discount" && (
                  <div className="mt-3 space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      会员折扣系数（1 = 1 折，10 = 不打折，可自由输入或点击 ± 调整）
                    </label>
                    <div className="flex items-stretch gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-10 shrink-0 px-0"
                        onClick={() => {
                          const cur = Math.max(
                            1,
                            Math.min(10, Math.round(Number(discountText) || 1) - 1),
                          );
                          setMemberDiscount(cur);
                          setDiscountText(String(cur));
                        }}
                      >
                        −
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        value={discountText}
                        onChange={(e) => setDiscountText(e.target.value)}
                        onBlur={() => {
                          const n = parseInt(discountText, 10);
                          if (!Number.isFinite(n) || discountText.trim() === "") {
                            setMemberDiscount(10);
                            setDiscountText("10");
                          } else {
                            const v = Math.min(10, Math.max(1, Math.round(n)));
                            setMemberDiscount(v);
                            setDiscountText(String(v));
                          }
                        }}
                        placeholder="如：5"
                        className="text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-10 shrink-0 px-0"
                        onClick={() => {
                          const cur = Math.max(
                            1,
                            Math.min(10, Math.round(Number(discountText) || 1) + 1),
                          );
                          setMemberDiscount(cur);
                          setDiscountText(String(cur));
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  若设置「会员免费」：普通用户按基础积分数，会员免费；若设置「会员折扣」：会员在基础积分数上按所选系数（1=1折
                  … 10=不打折）计算。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={busy}
            className="font-mono text-xs uppercase tracking-widest rounded-none"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-widest"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : isEdit ? (
              "保存"
            ) : (
              "添加"
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export function PostResourceModal(props: PostResourceModalProps) {
  return (
    <ClientOnly>
      <PostResourceModalInternal {...props} />
    </ClientOnly>
  );
}
