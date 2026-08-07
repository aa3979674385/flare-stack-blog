import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePointConfig, systemConfigQuery } from "@/features/config/queries";
import { updatePointConfigFn, updateSystemConfigFn } from "@/features/config/api/config.api";

export const Route = createFileRoute("/admin/points-settings/")({
  ssr: "data-only",
  component: PointsSettingsPage,
  loader: () => ({ title: "积分设置" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function PointsSettingsPage() {
  const { data: config, isLoading } = usePointConfig();
  const { data: sysConfig } = useQuery(systemConfigQuery);
  const [pointsName, setPointsName] = useState("");
  const [creditsName, setCreditsName] = useState("");
  const [pointsPerYuan, setPointsPerYuan] = useState("10");
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // 每日下载限制（普通用户 / 会员用户）
  const [normalDaily, setNormalDaily] = useState("0");
  const [memberDaily, setMemberDaily] = useState("0");
  const [savingDl, setSavingDl] = useState(false);
  const [cardKeyUrl, setCardKeyUrl] = useState("");
  const [savingCardKey, setSavingCardKey] = useState(false);

  useEffect(() => {
    if (config) {
      setPointsName(config.pointsName);
      setCreditsName(config.creditsName);
      setPointsPerYuan(String(config.pointsPerYuan ?? 10));
      setPaymentEnabled(config.paymentEnabled ?? false);
    }
  }, [config]);

  useEffect(() => {
    if (sysConfig?.downloadLimit) {
      setNormalDaily(String(sysConfig.downloadLimit.normalUserDaily ?? 0));
      setMemberDaily(String(sysConfig.downloadLimit.memberDaily ?? 0));
    }
  }, [sysConfig]);

  useEffect(() => {
    if (sysConfig?.site) {
      setCardKeyUrl(sysConfig.site.cardKeyPurchaseUrl ?? "");
    }
  }, [sysConfig]);

  const parsedRatio = Number(pointsPerYuan);
  const ratioValid = Number.isFinite(parsedRatio) && parsedRatio > 0;
  const dirty =
    (pointsName !== config?.pointsName ||
      creditsName !== config?.creditsName ||
      Number(config?.pointsPerYuan ?? 10) !== parsedRatio ||
      (config?.paymentEnabled ?? false) !== paymentEnabled) &&
    pointsName.trim() !== "" &&
    creditsName.trim() !== "" &&
    ratioValid;

  const parsedNormal = Number(normalDaily);
  const parsedMember = Number(memberDaily);
  const dlValid =
    Number.isFinite(parsedNormal) &&
    parsedNormal >= 0 &&
    Number.isInteger(parsedNormal) &&
    Number.isFinite(parsedMember) &&
    parsedMember >= 0 &&
    Number.isInteger(parsedMember);
  const dlDirty =
    !!sysConfig &&
    dlValid &&
    (parsedNormal !== (sysConfig.downloadLimit?.normalUserDaily ?? 0) ||
      parsedMember !== (sysConfig.downloadLimit?.memberDaily ?? 0));

  const handleSave = async () => {
    if (pointsName.trim() === "" || creditsName.trim() === "") {
      toast.error("名称不能为空");
      return;
    }
    if (!ratioValid) {
      toast.error("积分比例必须为正数");
      return;
    }
    setSaving(true);
    try {
      await updatePointConfigFn({
        data: {
          pointsName: pointsName.trim(),
          creditsName: creditsName.trim(),
          pointsPerYuan: Math.floor(parsedRatio),
          paymentEnabled,
        },
      });
      toast.success("已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDownloadLimit = async () => {
    if (!dlValid) {
      toast.error("请输入非负整数");
      return;
    }
    setSavingDl(true);
    try {
      await updateSystemConfigFn({
        data: {
          downloadLimit: {
            normalUserDaily: parsedNormal,
            memberDaily: parsedMember,
          },
        },
      });
      toast.success("已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingDl(false);
    }
  };

  const cardDirty =
    !!sysConfig?.site &&
    cardKeyUrl.trim() !== (sysConfig.site.cardKeyPurchaseUrl ?? "");

  const handleSaveCardKey = async () => {
    setSavingCardKey(true);
    try {
      await updateSystemConfigFn({
        data: { site: { cardKeyPurchaseUrl: cardKeyUrl.trim() } },
      });
      toast.success("已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingCardKey(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-foreground">
          积分设置
        </h1>
        <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
          Points Settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins size={16} className="opacity-60" />
            积分名称配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            设置两套积分在前台展示的名称。修改后前台会员积分页、后台用户详情页将同步更新。
          </p>

          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              普通积分名称
            </label>
            <Input
              value={pointsName}
              maxLength={20}
              onChange={(e) => setPointsName(e.target.value)}
              placeholder="如：积分 / 金币 / 成长值"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              会员积分名称
            </label>
            <Input
              value={creditsName}
              maxLength={20}
              onChange={(e) => setCreditsName(e.target.value)}
              placeholder="如：会员积分 / 钻石 / 尊享值"
            />
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="h-11 px-8 rounded-none bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : null}
            保存
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins size={16} className="opacity-60" />
            积分计费与支付
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            资源仅以「积分」计价。当用户的积分不足时，系统会按下方比例自动折算成人民币；
            若已接入支付网关，则生成支付订单并调起支付（当前支付为占位，需后台接入）。
          </p>

          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              积分比例（多少积分 = 1 元）
            </label>
            <Input
              type="number"
              min={1}
              step={1}
              value={pointsPerYuan}
              onChange={(e) => setPointsPerYuan(e.target.value)}
              placeholder="如：10"
            />
            <p className="text-xs text-muted-foreground">
              例如填 10，即「10 积分 = ¥1」。资源标价 100 积分时，积分不足将折算为 ¥10。
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={paymentEnabled}
              onChange={(e) => setPaymentEnabled(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            <span className="text-sm">
              已接入支付网关（开启后，积分不足可折算人民币支付；关闭则积分不足无法购买）
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download size={16} className="opacity-60" />
            每日下载限制
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            限制每位用户每天可下载的「不同文章」篇数（免费与收费资源均计入，同一天重复下载同一篇文章不计数）。
            普通用户与会员用户可分别设置；填 0 表示不限制。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                普通用户每日下载篇数
              </label>
              <Input
                type="number"
                min={0}
                step={1}
                value={normalDaily}
                onChange={(e) => setNormalDaily(e.target.value)}
                placeholder="0 = 不限制"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                会员用户每日下载篇数
              </label>
              <Input
                type="number"
                min={0}
                step={1}
                value={memberDaily}
                onChange={(e) => setMemberDaily(e.target.value)}
                placeholder="0 = 不限制"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSaveDownloadLimit}
            disabled={!dlDirty || savingDl || !dlValid}
            className="h-11 px-8 rounded-none bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {savingDl ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : null}
            保存
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins size={16} className="opacity-60" />
            卡密购买配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            配置卡密购买页地址。会员中心「输入卡密」处会显示「前往购买卡密」入口并跳转此链接；留空则不显示。
          </p>
          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              购买卡密链接
            </label>
            <Input
              value={cardKeyUrl}
              maxLength={500}
              onChange={(e) => setCardKeyUrl(e.target.value)}
              placeholder="https://example.com/buy-card-key"
            />
          </div>
          <Button
            type="button"
            onClick={handleSaveCardKey}
            disabled={!cardDirty || savingCardKey}
            className="h-11 px-8 rounded-none bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {savingCardKey ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : null}
            保存
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
