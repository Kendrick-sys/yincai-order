/**
 * 修改密码页（所有已登录用户可用）
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ChevronLeft, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function ChangePassword() {
  usePageTitle("修改密码");
  const [, navigate] = useLocation();
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changeMutation = trpc.userManagement.changeMyPassword.useMutation({
    onSuccess: () => {
      toast.success("密码修改成功，请重新登录");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => navigate("/"), 1500);
    },
    onError: (err) => toast.error(err.message || "修改失败"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning("请填写所有字段");
      return;
    }
    if (newPassword.length < 6) {
      toast.warning("新密码至少6位");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning("两次输入的新密码不一致");
      return;
    }
    changeMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-slate-500 hover:text-slate-700 -ml-2">
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <div className="w-px h-5 bg-slate-200" />
        <h1 className="font-semibold text-slate-800">修改密码</h1>
      </div>

      {/* 内容区 */}
      <div className="max-w-sm mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#1A3C5E]" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{user?.displayName ?? user?.name}</p>
              <p className="text-xs text-slate-400">修改登录密码</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>当前密码</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  placeholder="请输入当前密码"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>新密码</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  placeholder="至少6位"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>确认新密码</Label>
              <Input
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#1A3C5E] hover:bg-[#15304e] text-white mt-2"
              disabled={changeMutation.isPending}
            >
              {changeMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</>
              ) : "保存新密码"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
