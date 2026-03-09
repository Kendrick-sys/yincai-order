/**
 * 账号管理页（管理员专属）
 * 功能：查看所有账号、新建账号、修改姓名/角色、停用/启用、重置密码、转移客户
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Plus, UserCheck, UserX, KeyRound, ChevronLeft,
  Shield, User, Loader2, Eye, EyeOff, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

// ─── 类型 ─────────────────────────────────────────────────────────────────────

type AppUser = {
  id: number;
  username: string | null;
  displayName: string | null;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: Date;
  lastSignedIn: Date;
};

// ─── 新建账号对话框 ───────────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [showPwd, setShowPwd] = useState(false);
  const utils = trpc.useUtils();

  const createMutation = trpc.userManagement.create.useMutation({
    onSuccess: () => {
      toast.success("账号创建成功");
      utils.userManagement.list.invalidate();
      onClose();
      setUsername(""); setPassword(""); setDisplayName(""); setRole("user");
    },
    onError: (err) => toast.error(err.message || "创建失败"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !displayName.trim()) {
      toast.warning("请填写所有必填项");
      return;
    }
    createMutation.mutate({ username: username.trim(), password, displayName: displayName.trim(), role });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>新建账号</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>姓名 <span className="text-destructive">*</span></Label>
            <Input placeholder="如：张三" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>用户名 <span className="text-destructive">*</span></Label>
            <Input placeholder="登录用，如：zhangsan" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>初始密码 <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="至少6位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">业务员</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-[#1A3C5E] hover:bg-[#15304e] text-white">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "创建账号"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 重置密码对话框 ───────────────────────────────────────────────────────────

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: AppUser | null;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const utils = trpc.useUtils();

  const resetMutation = trpc.userManagement.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(`已重置 ${user?.displayName ?? user?.username} 的密码`);
      utils.userManagement.list.invalidate();
      onClose();
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message || "重置失败"),
  });

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>重置密码 — {user?.displayName ?? user?.username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>新密码 <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="至少6位"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={() => {
              if (!user || !newPassword.trim()) { toast.warning("请输入新密码"); return; }
              resetMutation.mutate({ id: user.id, newPassword });
            }}
            disabled={resetMutation.isPending}
            className="bg-[#1A3C5E] hover:bg-[#15304e] text-white"
          >
            {resetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认重置"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 转移客户对话框 ───────────────────────────────────────────────────────────

function TransferDataDialog({
  user,
  allUsers,
  onClose,
}: {
  user: AppUser | null;
  allUsers: AppUser[];
  onClose: () => void;
}) {
  // "public" 表示设为公共（createdBy = null）
  const [toUserId, setToUserId] = useState<string>("public");
  const utils = trpc.useUtils();

  const transferMutation = trpc.userManagement.transferData.useMutation({
    onSuccess: () => {
      const targetName = toUserId === "public"
        ? "公共（所有管理员可见）"
        : allUsers.find((u) => u.id === Number(toUserId))?.displayName ?? "目标账号";
      toast.success(`已将「${user?.displayName ?? user?.username}」的客户和订单转移至 ${targetName}`);
      utils.userManagement.list.invalidate();
      onClose();
      setToUserId("public");
    },
    onError: (err) => toast.error(err.message || "转移失败"),
  });

  // 可转移的目标：除了当前被转移的用户外的所有用户
  const targetOptions = allUsers.filter((u) => u.id !== user?.id);

  const handleConfirm = () => {
    if (!user) return;
    const targetId = toUserId === "public" ? null : Number(toUserId);
    transferMutation.mutate({ fromUserId: user.id, toUserId: targetId });
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>转移客户与订单</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 pt-1">
            将「{user?.displayName ?? user?.username}」名下的所有客户和订单批量转移给其他人员，或设为公共（管理员可见）。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>转移给</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <span className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    设为公共（管理员可见）
                  </span>
                </SelectItem>
                {targetOptions.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {u.displayName ?? u.username}
                      {u.role === "admin" && (
                        <span className="text-xs text-slate-400">（管理员）</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
            此操作不可撤销，请确认转移目标后再执行。
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={handleConfirm}
            disabled={transferMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {transferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认转移"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function UserManagement() {
  usePageTitle("账号管理");
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [transferTarget, setTransferTarget] = useState<AppUser | null>(null);

  const { data: users = [], isLoading } = trpc.userManagement.list.useQuery(undefined, {
    retry: false,
  });
  const utils = trpc.useUtils();

  const updateMutation = trpc.userManagement.update.useMutation({
    onSuccess: () => {
      utils.userManagement.list.invalidate();
      toast.success("已更新");
    },
    onError: (err) => toast.error(err.message || "操作失败"),
  });

  const toggleActive = (u: AppUser) => {
    const action = u.isActive ? "停用" : "启用";
    if (!confirm(`确定要${action}账号「${u.displayName ?? u.username}」吗？`)) return;
    updateMutation.mutate({ id: u.id, isActive: !u.isActive });
  };

  // 管理员权限检查
  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">无权访问此页面</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>返回首页</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-slate-500 hover:text-slate-700 -ml-2">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div className="w-px h-5 bg-slate-200" />
          <h1 className="font-semibold text-slate-800">账号管理</h1>
        </div>
        <Button
          size="sm"
          className="bg-[#1A3C5E] hover:bg-[#15304e] text-white"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          新建账号
        </Button>
      </div>

      {/* 内容区 */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#1A3C5E]" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {/* 表头 */}
            <div className="grid grid-cols-[1fr_1fr_100px_100px_160px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <span>姓名 / 用户名</span>
              <span>最后登录</span>
              <span className="text-center">角色</span>
              <span className="text-center">状态</span>
              <span className="text-center">操作</span>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>暂无账号，点击右上角新建</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`grid grid-cols-[1fr_1fr_100px_100px_160px] gap-4 px-5 py-4 items-center transition-colors ${
                      !u.isActive ? "opacity-50 bg-slate-50/50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    {/* 姓名 */}
                    <div>
                      <p className="font-medium text-slate-800 text-sm">
                        {u.displayName ?? u.username}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-[#1A3C5E] font-normal">（当前账号）</span>
                        )}
                        {!u.isActive && (
                          <span className="ml-2 text-xs text-red-400 font-normal">已离职</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{u.username}</p>
                    </div>

                    {/* 最后登录 */}
                    <div className="text-xs text-slate-500">
                      {u.lastSignedIn
                        ? new Date(u.lastSignedIn).toLocaleString("zh-CN", {
                            month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </div>

                    {/* 角色 */}
                    <div className="flex justify-center">
                      {u.role === "admin" ? (
                        <Badge className="bg-[#1A3C5E]/10 text-[#1A3C5E] border-[#1A3C5E]/20 text-xs font-medium">
                          <Shield className="w-3 h-3 mr-1" />
                          管理员
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-slate-500">
                          <User className="w-3 h-3 mr-1" />
                          业务员
                        </Badge>
                      )}
                    </div>

                    {/* 状态 */}
                    <div className="flex justify-center">
                      {u.isActive ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">正常</Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">已停用</Badge>
                      )}
                    </div>

                    {/* 操作 */}
                    <div className="flex items-center justify-center gap-1">
                      {/* 重置密码 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-slate-500 hover:text-[#1A3C5E]"
                        onClick={() => setResetTarget(u as AppUser)}
                        title="重置密码"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>

                      {/* 转移客户（仅非当前账号可操作） */}
                      {u.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-slate-500 hover:text-amber-600"
                          onClick={() => setTransferTarget(u as AppUser)}
                          title="转移客户与订单"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      {/* 停用/启用（不能操作自己） */}
                      {u.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2 text-xs ${
                            u.isActive
                              ? "text-slate-500 hover:text-red-500"
                              : "text-slate-500 hover:text-green-600"
                          }`}
                          onClick={() => toggleActive(u as AppUser)}
                          title={u.isActive ? "停用账号" : "启用账号"}
                          disabled={updateMutation.isPending}
                        >
                          {u.isActive ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 说明文字 */}
        <p className="text-xs text-slate-400 mt-4 text-center">
          停用账号后，该账号将无法登录，但历史订单和客户数据会完整保留。可使用「转移」按钮将其客户和订单批量转移给其他人员。
        </p>
      </div>

      {/* 对话框 */}
      <CreateUserDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      <TransferDataDialog
        user={transferTarget}
        allUsers={users as AppUser[]}
        onClose={() => setTransferTarget(null)}
      />
    </div>
  );
}
