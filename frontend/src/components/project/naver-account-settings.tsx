"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  LogIn,
  Pencil,
  Save,
} from "lucide-react";
import type { NaverAccount } from "@/types";
import {
  checkConnection,
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  testLogin,
} from "@/lib/publisher-client";

interface NaverAccountSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NaverAccountSettings({
  open,
  onOpenChange,
}: NaverAccountSettingsProps) {
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState<NaverAccount[]>([]);
  const [loading, setLoading] = useState(false);

  // 새 계정
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [adding, setAdding] = useState(false);

  // 수정 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // 로그인 테스트
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const ok = await checkConnection();
      setConnected(ok);
      if (ok) {
        setLoading(true);
        try {
          const accs = await getAccounts();
          setAccounts(accs);
        } catch {}
        setLoading(false);
      }
    })();
  }, [open]);

  const handleAdd = useCallback(async () => {
    if (!newUsername.trim()) return;
    setAdding(true);
    try {
      const acc = await addAccount(newUsername.trim(), newPassword, newNickname.trim());
      setAccounts((prev) => [...prev, acc]);
      setNewUsername("");
      setNewPassword("");
      setNewNickname("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "계정 추가 실패");
    }
    setAdding(false);
  }, [newUsername, newPassword, newNickname]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("이 계정을 삭제하시겠습니까?")) return;
    try {
      await deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  }, []);

  const handleEdit = useCallback((acc: NaverAccount) => {
    setEditingId(acc.id);
    setEditNickname(acc.nickname || "");
    setEditPassword("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    try {
      const data: { nickname?: string; password?: string } = {};
      if (editNickname !== undefined) data.nickname = editNickname;
      if (editPassword) data.password = editPassword;

      const updated = await updateAccount(editingId, data);
      setAccounts((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
      setEditingId(null);
    } catch {}
  }, [editingId, editNickname, editPassword]);

  const handleTestLogin = useCallback(async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await testLogin(id);
      setTestResult({ id, ...result });
    } catch {
      setTestResult({ id, success: false, message: "테스트 실패" });
    }
    setTestingId(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>네이버 계정 관리</DialogTitle>
        </DialogHeader>

        {!connected ? (
          <p className="text-sm text-muted-foreground py-4">
            BlogPublisher 앱이 실행되지 않았습니다. 앱을 실행한 후 다시 시도해주세요.
          </p>
        ) : (
          <div className="space-y-4">
            {/* 계정 목록 */}
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 계정이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    {editingId === acc.id ? (
                      /* 수정 모드 */
                      <div className="space-y-2">
                        <div className="text-sm font-medium">{acc.username}</div>
                        <div>
                          <Label className="text-xs">별명</Label>
                          <Input
                            value={editNickname}
                            onChange={(e) => setEditNickname(e.target.value)}
                            placeholder="예: 회사 블로그"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">비밀번호 변경 (빈칸이면 유지)</Label>
                          <Input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="새 비밀번호"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            저장
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* 보기 모드 */
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {acc.nickname ? (
                              <>
                                {acc.nickname}
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({acc.username})
                                </span>
                              </>
                            ) : (
                              acc.username
                            )}
                          </div>
                          {acc.last_post_at && (
                            <div className="text-xs text-muted-foreground">
                              마지막 발행: {new Date(acc.last_post_at).toLocaleDateString("ko-KR")}
                            </div>
                          )}
                          {testResult?.id === acc.id && (
                            <Badge
                              variant={testResult.success ? "default" : "destructive"}
                              className="mt-1"
                            >
                              {testResult.success ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {testResult.message}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(acc)} title="수정">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestLogin(acc.id)}
                            disabled={testingId === acc.id}
                            title="로그인 테스트"
                          >
                            {testingId === acc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogIn className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)} title="삭제">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 계정 추가 */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-medium">새 계정 추가</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">네이버 아이디</Label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="naver_id"
                  />
                </div>
                <div>
                  <Label className="text-xs">비밀번호</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="비밀번호"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">별명 (선택)</Label>
                <Input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="예: 회사 블로그, 개인 블로그"
                />
              </div>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newUsername.trim() || adding}
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                추가
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
