/**
 * 登录页
 * 自建账号密码登录，替换 Manus OAuth
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // 默认勾选「记住我」

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("登录成功");
      // 检查 URL 参数中是否有 returnTo
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      navigate(returnTo && returnTo.startsWith("/") ? returnTo : "/");
    },
    onError: (err) => {
      toast.error(err.message || "登录失败，请重试");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.warning("请填写用户名和密码");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password, rememberMe });
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#1A3C5E]/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#1A3C5E]/5" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275986025/MnhiE9LdbgqX24MUwA2SN8/logo-192_cb43ed67.png"
            alt="吟彩 Logo"
            className="w-14 h-14 rounded-2xl object-contain shadow-lg mb-4 inline-block"
          />
          <h1
            className="text-2xl font-bold text-[#1A3C5E]"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            吟彩销售订单系统
          </h1>
          <p className="text-sm text-slate-500 mt-1">请登录以继续使用</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                用户名
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={loginMutation.isPending}
                className="h-10"
              />
            </div>

            {/* 密码 */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                密码
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 记住我 */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(!!v)}
                disabled={loginMutation.isPending}
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm text-slate-600 cursor-pointer select-none"
              >
                记住我（30 天内免登录）
              </Label>
            </div>

            {/* 登录按鈕 */}
            <Button
              type="submit"
              className="w-full h-10 bg-[#1A3C5E] hover:bg-[#15304e] text-white font-medium"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  登录
                </>
              )}
            </Button>
          </form>
        </div>

        {/* 底部提示 */}
        <p className="text-center text-xs text-slate-400 mt-6">
          忘记密码？请联系系统管理员重置
        </p>
      </div>
    </div>
  );
}
