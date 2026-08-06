import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Lock, Unlock, RefreshCcw, Trash2, Power, UserPlus, Copy, Download as DownloadIcon, Edit, LogOut, Shield, Users, KeyRound, FileDown, BookOpen, AlertTriangle, Video } from "lucide-react";

export default function Home() {
  const utils = trpc.useUtils();
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Login realizado com sucesso!");
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Sessão encerrada.");
      utils.auth.me.invalidate();
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Preencha usuário e senha.");
      return;
    }
    const deviceIdentifier = localStorage.getItem("device_id") || Math.random().toString(36).substring(2);
    localStorage.setItem("device_id", deviceIdentifier);

    loginMutation.mutate({ username, password, deviceIdentifier });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white flex items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col items-center justify-center px-4 font-sans">
        <div className="w-full max-w-md bg-[#141414] border border-neutral-800 rounded-xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-red-600 tracking-wider">SHELBY PANEL</h1>
            <p className="text-xs text-neutral-400">Painel de Acesso & Distribuição</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-white font-semibold">Usuário</label>
              <Input
                className="bg-[#222] border-neutral-700 text-white placeholder:text-neutral-500"
                placeholder="Ex: seu login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white font-semibold">Senha</label>
              <Input
                type="password"
                className="bg-[#222] border-neutral-700 text-white placeholder:text-neutral-500"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2">
              Entrar na Plataforma
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white font-sans flex flex-col">
      <header className="border-b border-neutral-800 bg-[#111] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-red-600 tracking-wider">SHELBY PANEL</span>
          <Badge className="bg-neutral-800 text-white border-neutral-700 uppercase text-[10px]">
            {user.role}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-300 font-medium hidden sm:inline">Olá, <strong className="text-white">{user.username}</strong></span>
          <Button variant="outline" size="sm" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => logoutMutation.mutate()}>
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
        {user.role === "moderator" && <ModeratorDashboard />}
        {user.role === "reseller" && <ResellerDashboard />}
        {user.role === "client" && <ClientDashboard />}
      </main>
    </div>
  );
}

function ModeratorDashboard() {
  const { data: stats } = trpc.moderator.dashboardStats.useQuery();
  const { data: resellers, refetch: refetchResellers } = trpc.moderator.listResellers.useQuery();
  const { data: clients, refetch: refetchClients } = trpc.moderator.listClients.useQuery();
  const { data: keysList, refetch: refetchKeys } = trpc.moderator.listKeys.useQuery();
  const { data: downloadsList, refetch: refetchDownloads } = trpc.moderator.listDownloads.useQuery();
  const { data: tutorialsList, refetch: refetchTutorials } = trpc.moderator.listTutorials.useQuery();
  const { data: logsList } = trpc.moderator.listLogs.useQuery();

  const utils = trpc.useUtils();

  const [newResellerUser, setNewResellerUser] = useState("");
  const [newResellerPass, setNewResellerPass] = useState("");
  const [newResellerCreditsBasic, setNewResellerCreditsBasic] = useState(10);
  const [newResellerCreditsAdvanced, setNewResellerCreditsAdvanced] = useState(10);

  const [newKeyVal, setNewKeyVal] = useState("");
  const [newKeyType, setNewKeyType] = useState<"basic" | "advanced">("advanced");
  const [batchKeysText, setBatchKeysText] = useState("");
  const [batchKeyType, setBatchKeyType] = useState<"basic" | "advanced">("advanced");

  const [dlTitle, setDlTitle] = useState("");
  const [dlDesc, setDlDesc] = useState("");
  const [dlVersion, setDlVersion] = useState("1.0");
  const [dlUrl, setDlUrl] = useState("");
  const [dlType, setDlType] = useState<"basic" | "advanced">("basic");
  const [editingDownload, setEditingDownload] = useState<any | null>(null);

  const [tutTitle, setTutTitle] = useState("");
  const [tutDesc, setTutDesc] = useState("");
  const [tutUrl, setTutUrl] = useState("");
  const [tutType, setTutType] = useState<"basic" | "advanced">("basic");

  const createResellerMutation = trpc.moderator.createReseller.useMutation({
    onSuccess: () => {
      toast.success("Revendedor criado com sucesso!");
      setNewResellerUser("");
      setNewResellerPass("");
      refetchResellers();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCreditsMutation = trpc.moderator.updateResellerCredits.useMutation({
    onSuccess: () => {
      toast.success("Créditos atualizados!");
      refetchResellers();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleStatusMutation = trpc.moderator.toggleUserStatus.useMutation({
    onSuccess: () => {
      toast.success("Status alterado!");
      refetchResellers();
      refetchClients();
    },
  });

  const resetSessionMutation = trpc.moderator.resetUserSession.useMutation({
    onSuccess: () => toast.success("Sessão resetada!"),
  });

  const toggleResellerPremiumMutation = trpc.moderator.toggleResellerPremium.useMutation({
    onSuccess: (res) => {
      toast.success(res.isPremium ? "Revendedor promovido a Premium!" : "Status Premium removido.");
      refetchResellers();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPasswordMutation = trpc.moderator.resetUserPassword.useMutation({
    onSuccess: () => toast.success("Senha alterada com sucesso!"),
  });

  const deleteUserMutation = trpc.moderator.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído!");
      refetchResellers();
      refetchClients();
    },
  });

  const addKeyMutation = trpc.moderator.addKey.useMutation({
    onSuccess: () => {
      toast.success("Key adicionada!");
      setNewKeyVal("");
      refetchKeys();
    },
    onError: (e) => toast.error(e.message),
  });

  const batchAddKeysMutation = trpc.moderator.importKeysBatch.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.added} keys importadas com sucesso!`);
      setBatchKeysText("");
      refetchKeys();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleKeyMutation = trpc.moderator.toggleKeyStatus.useMutation({
    onSuccess: () => {
      toast.success("Status da key alterado!");
      refetchKeys();
    },
  });

  const deleteKeyMutation = trpc.moderator.deleteKey.useMutation({
    onSuccess: () => {
      toast.success("Key excluída!");
      refetchKeys();
    },
  });

  const addDownloadMutation = trpc.moderator.addDownload.useMutation({
    onSuccess: () => {
      toast.success("Download cadastrado!");
      setDlTitle("");
      setDlDesc("");
      setDlUrl("");
      refetchDownloads();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDownloadMutation = trpc.moderator.updateDownload.useMutation({
    onSuccess: () => {
      toast.success("Download atualizado!");
      setEditingDownload(null);
      refetchDownloads();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDownloadMutation = trpc.moderator.deleteDownload.useMutation({
    onSuccess: () => {
      toast.success("Download excluído!");
      refetchDownloads();
    },
  });

  const addTutorialMutation = trpc.moderator.addTutorial.useMutation({
    onSuccess: () => {
      toast.success("Tutorial cadastrado!");
      setTutTitle("");
      setTutDesc("");
      setTutUrl("");
      refetchTutorials();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTutorialMutation = trpc.moderator.deleteTutorial.useMutation({
    onSuccess: () => {
      toast.success("Tutorial excluído!");
      refetchTutorials();
    },
  });

  const exportKeys = () => {
    if (!keysList) return;
    const text = keysList.map((k) => k.keyValue).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keys_shelby.txt";
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Total Clientes</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-white">{stats?.totalClients || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Revendedores</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-white">{stats?.totalResellers || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Keys Cadastradas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-amber-400">{stats?.totalKeys || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Keys Usadas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-emerald-400">{stats?.usedKeys || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#141414] border-neutral-800 text-white col-span-2 md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Sessões Ativas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-red-500">{stats?.activeSessions || 0}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resellers" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="bg-[#141414] border border-neutral-800 p-1 flex w-max sm:w-full">
            <TabsTrigger value="resellers" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Revendedores</TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Clientes</TabsTrigger>
            <TabsTrigger value="keys" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Gerenciar Keys</TabsTrigger>
            <TabsTrigger value="downloads" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Downloads</TabsTrigger>
            <TabsTrigger value="tutorials" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Tutoriais</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Logs de Auditoria</TabsTrigger>
          </TabsList>
        </div>

        {/* REVENDEDORES */}
        <TabsContent value="resellers" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Criar Novo Revendedor</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Usuário</label>
                  <Input className="bg-[#222] border-neutral-700 text-white" value={newResellerUser} onChange={(e) => setNewResellerUser(e.target.value)} placeholder="revendedor1" />
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Senha</label>
                  <Input type="password" className="bg-[#222] border-neutral-700 text-white" value={newResellerPass} onChange={(e) => setNewResellerPass(e.target.value)} placeholder="senha" />
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Créditos Basic</label>
                  <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsBasic} onChange={(e) => setNewResellerCreditsBasic(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Créditos Advanced</label>
                  <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsAdvanced} onChange={(e) => setNewResellerCreditsAdvanced(Number(e.target.value))} />
                </div>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => createResellerMutation.mutate({ username: newResellerUser, password: newResellerPass, creditsBasic: newResellerCreditsBasic, creditsAdvanced: newResellerCreditsAdvanced })}>
                  <UserPlus className="w-4 h-4 mr-1" /> Criar Revendedor
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Lista de Revendedores</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-white font-bold">ID</TableHead>
                    <TableHead className="text-white font-bold">Usuário</TableHead>
                    <TableHead className="text-white font-bold">Créditos</TableHead>
                    <TableHead className="text-white font-bold">Clientes</TableHead>
                    <TableHead className="text-white font-bold">Tipo</TableHead>
                    <TableHead className="text-white font-bold">Status</TableHead>
                    <TableHead className="text-white font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resellers?.map((r) => (
                    <TableRow key={r.id} className="border-neutral-800">
                      <TableCell className="font-mono text-white">#{r.id}</TableCell>
                      <TableCell className="font-bold text-white">{r.username}</TableCell>
                      <TableCell className="space-y-1">
                        <div className="text-xs font-mono text-white">Basic: <strong className="text-red-500">{r.creditsBasic}</strong> <Button size="sm" variant="ghost" className="text-white p-0 h-auto underline" onClick={() => {
                          const action = prompt(`Adicionar ou remover créditos Basic para ${r.username}? (add ou remove):`);
                          if (action === "add" || action === "remove") {
                            const val = prompt("Quantidade:");
                            const num = parseInt(val || "0", 10);
                            if (!isNaN(num) && num > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "basic", action, amount: num });
                          }
                        }}>±</Button></div>
                        <div className="text-xs font-mono text-white">Advanced: <strong className="text-amber-400">{r.creditsAdvanced}</strong> <Button size="sm" variant="ghost" className="text-white p-0 h-auto underline" onClick={() => {
                          const action = prompt(`Adicionar ou remover créditos Advanced para ${r.username}? (add ou remove):`);
                          if (action === "add" || action === "remove") {
                            const val = prompt("Quantidade:");
                            const num = parseInt(val || "0", 10);
                            if (!isNaN(num) && num > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "advanced", action, amount: num });
                          }
                        }}>±</Button></div>
                      </TableCell>
                      <TableCell className="text-white">{r.clientCount}</TableCell>
                      <TableCell>
                        <Badge className={r.isPremium ? "bg-amber-500 text-black font-bold border-amber-600" : "bg-neutral-800 text-neutral-300 border-neutral-700"}>
                          {r.isPremium ? "★ Premium" : "Comum"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={r.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-red-950 text-red-400 border-red-800"}>
                          {r.isActive ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" className={r.isPremium ? "border-amber-500 text-amber-400 bg-amber-950/30" : "border-neutral-700 bg-transparent text-white hover:bg-neutral-800"} title="Alternar Premium" onClick={() => toggleResellerPremiumMutation.mutate({ resellerId: r.id })}>
                          ★
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => toggleStatusMutation.mutate({ userId: r.id })}>
                          {r.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => resetSessionMutation.mutate({ userId: r.id })}>
                          <RefreshCcw className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => {
                          const p = prompt("Nova senha:");
                          if (p) resetPasswordMutation.mutate({ userId: r.id, newPassword: p });
                        }}>Senha</Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          if (confirm("Excluir revendedor?")) deleteUserMutation.mutate({ userId: r.id });
                        }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CLIENTES */}
        <TabsContent value="clients" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Todos os Clientes do Sistema</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-white font-bold">ID</TableHead>
                    <TableHead className="text-white font-bold">Usuário</TableHead>
                    <TableHead className="text-white font-bold">Key Atribuída</TableHead>
                    <TableHead className="text-white font-bold">Revendedor</TableHead>
                    <TableHead className="text-white font-bold">Status</TableHead>
                    <TableHead className="text-white font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients?.map((c) => (
                    <TableRow key={c.id} className="border-neutral-800">
                      <TableCell className="font-mono text-white">#{c.id}</TableCell>
                      <TableCell className="font-bold text-white">{c.username}</TableCell>
                      <TableCell className="font-mono text-xs text-amber-400">{c.keyValue}</TableCell>
                      <TableCell className="text-white">{c.resellerName}</TableCell>
                      <TableCell>
                        <Badge className={c.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-red-950 text-red-400 border-red-800"}>
                          {c.isActive ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => toggleStatusMutation.mutate({ userId: c.id })}>
                          {c.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => resetSessionMutation.mutate({ userId: c.id })}>
                          <RefreshCcw className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => {
                          const p = prompt("Nova senha:");
                          if (p) resetPasswordMutation.mutate({ userId: c.id, newPassword: p });
                        }}>Senha</Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          if (confirm("Excluir cliente?")) deleteUserMutation.mutate({ userId: c.id });
                        }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GERENCIAR KEYS */}
        <TabsContent value="keys" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader><CardTitle className="text-white">Adicionar Key Individual</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Tipo de Proxy</label>
                  <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={newKeyType} onChange={(e: any) => setNewKeyType(e.target.value)}>
                    <option value="basic">Proxy Android Basic</option>
                    <option value="advanced">Proxy Android Advanced</option>
                  </select>
                </div>
                <Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Ex: SHELBY-XXXX-YYYY" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} />
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: newKeyType })}>
                  Adicionar Key
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader><CardTitle className="text-white">Importar Keys em Lote (.txt)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Tipo de Proxy</label>
                  <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={batchKeyType} onChange={(e: any) => setBatchKeyType(e.target.value)}>
                    <option value="basic">Proxy Android Basic</option>
                    <option value="advanced">Proxy Android Advanced</option>
                  </select>
                </div>
                <textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Cole uma key por linha..." value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} />
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: batchKeyType })}>
                  Importar em Lote
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Keys - Proxy Android Basic</CardTitle>
                <Button size="sm" className="bg-neutral-800 hover:bg-neutral-700 text-white" onClick={() => {
                  if (!keysList) return;
                  const text = keysList.filter(k => k.type === "basic").map((k) => k.keyValue).join("\n");
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "keys_basic.txt";
                  a.click();
                }}>
                  Exportar Basic (.txt)
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-white font-bold">ID</TableHead>
                      <TableHead className="text-white font-bold">Key Value</TableHead>
                      <TableHead className="text-white font-bold">Status Uso</TableHead>
                      <TableHead className="text-white font-bold">Estado Ativação</TableHead>
                      <TableHead className="text-white font-bold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keysList?.filter(k => k.type === "basic").map((k) => (
                      <TableRow key={k.id} className="border-neutral-800">
                        <TableCell className="font-mono text-white">#{k.id}</TableCell>
                        <TableCell className="font-mono text-red-500 font-bold">{k.keyValue}</TableCell>
                        <TableCell>
                          <Badge className={k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-emerald-950 text-emerald-400 border-emerald-800"}>
                            {k.isUsed ? "Usada" : "Disponível"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={k.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-red-950 text-red-400 border-red-800"}>
                            {k.isActive ? "Ativa" : "Desativada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => toggleKeyMutation.mutate({ keyId: k.id })}>
                            <Power className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </CardContent>
            </Card>

            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Keys - Proxy Android Advanced</CardTitle>
                <Button size="sm" className="bg-neutral-800 hover:bg-neutral-700 text-white" onClick={() => {
                  if (!keysList) return;
                  const text = keysList.filter(k => k.type === "advanced").map((k) => k.keyValue).join("\n");
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "keys_advanced.txt";
                  a.click();
                }}>
                  Exportar Advanced (.txt)
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-white font-bold">ID</TableHead>
                      <TableHead className="text-white font-bold">Key Value</TableHead>
                      <TableHead className="text-white font-bold">Status Uso</TableHead>
                      <TableHead className="text-white font-bold">Estado Ativação</TableHead>
                      <TableHead className="text-white font-bold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keysList?.filter(k => k.type === "advanced").map((k) => (
                      <TableRow key={k.id} className="border-neutral-800">
                        <TableCell className="font-mono text-white">#{k.id}</TableCell>
                        <TableCell className="font-mono text-amber-400 font-bold">{k.keyValue}</TableCell>
                        <TableCell>
                          <Badge className={k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-emerald-950 text-emerald-400 border-emerald-800"}>
                            {k.isUsed ? "Usada" : "Disponível"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={k.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-red-950 text-red-400 border-red-800"}>
                            {k.isActive ? "Ativa" : "Desativada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => toggleKeyMutation.mutate({ keyId: k.id })}>
                            <Power className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DOWNLOADS */}
        <TabsContent value="downloads" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">{editingDownload ? "Editar Download" : "Cadastrar Novo Download"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-white font-semibold block mb-1">Tipo de Download</label>
                <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={editingDownload ? editingDownload.type : dlType} onChange={(e: any) => editingDownload ? setEditingDownload({...editingDownload, type: e.target.value}) : setDlType(e.target.value)}>
                  <option value="basic">Proxy Android Basic</option>
                  <option value="advanced">Proxy Android Advanced</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={editingDownload ? editingDownload.title : dlTitle} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, title: e.target.value}) : setDlTitle(e.target.value)} />
                <Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={editingDownload ? editingDownload.version : dlVersion} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, version: e.target.value}) : setDlVersion(e.target.value)} />
              </div>
              <Input className="bg-[#222] border-neutral-700 text-white" placeholder="URL de Download" value={editingDownload ? editingDownload.fileUrl : dlUrl} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, fileUrl: e.target.value}) : setDlUrl(e.target.value)} />
              <textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" placeholder="Descrição..." value={editingDownload ? (editingDownload.description || "") : dlDesc} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, description: e.target.value}) : setDlDesc(e.target.value)} />
              
              <div className="flex gap-2">
                {editingDownload ? (
                  <>
                    <Button className="bg-red-600 hover:bg-red-700 text-white flex-1" onClick={() => updateDownloadMutation.mutate(editingDownload)}>
                      Salvar Alterações
                    </Button>
                    <Button variant="outline" className="border-neutral-700 text-white bg-transparent" onClick={() => setEditingDownload(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button className="bg-red-600 hover:bg-red-700 text-white w-full" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: dlType })}>
                    Cadastrar Download
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Downloads Cadastrados</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-white font-bold">Título</TableHead>
                    <TableHead className="text-white font-bold">Tipo</TableHead>
                    <TableHead className="text-white font-bold">Versão</TableHead>
                    <TableHead className="text-white font-bold">Link</TableHead>
                    <TableHead className="text-white font-bold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloadsList?.map((d) => (
                    <TableRow key={d.id} className="border-neutral-800">
                      <TableCell className="font-bold text-white">{d.title}</TableCell>
                      <TableCell><Badge className={d.type === "advanced" ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-neutral-800 text-white"}>{d.type === "advanced" ? "Advanced" : "Basic"}</Badge></TableCell>
                      <TableCell className="text-white">{d.version}</TableCell>
                      <TableCell className="text-blue-400 truncate max-w-xs">{d.fileUrl}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => setEditingDownload(d)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteDownloadMutation.mutate({ downloadId: d.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TUTORIAIS */}
        <TabsContent value="tutorials" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Cadastrar Novo Tutorial (Link)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-white font-semibold block mb-1">Tipo de Tutorial</label>
                <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={tutType} onChange={(e: any) => setTutType(e.target.value)}>
                  <option value="basic">Proxy Android Basic</option>
                  <option value="advanced">Proxy Android Advanced</option>
                </select>
              </div>
              <Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título do Tutorial (ex: Como configurar o painel)" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} />
              <Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do Vídeo/Tutorial (ex: https://youtube.com/... ou link direto)" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} />
              <textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" placeholder="Descrição ou instruções..." value={tutDesc} onChange={(e) => setTutDesc(e.target.value)} />
              <Button className="bg-red-600 hover:bg-red-700 text-white w-full" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: tutType })}>
                Cadastrar Tutorial
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Tutoriais Cadastrados</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-white font-bold">Título</TableHead>
                    <TableHead className="text-white font-bold">Tipo</TableHead>
                    <TableHead className="text-white font-bold">Link</TableHead>
                    <TableHead className="text-white font-bold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tutorialsList?.map((t) => (
                    <TableRow key={t.id} className="border-neutral-800">
                      <TableCell className="font-bold text-white">{t.title}</TableCell>
                      <TableCell><Badge className={t.type === "advanced" ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-neutral-800 text-white"}>{t.type === "advanced" ? "Advanced" : "Basic"}</Badge></TableCell>
                      <TableCell><a href={t.videoUrl} target="_blank" rel="noreferrer" className="text-blue-400 underline truncate max-w-xs block">{t.videoUrl}</a></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" onClick={() => deleteTutorialMutation.mutate({ tutorialId: t.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Logs de Auditoria do Sistema</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-white font-bold">ID</TableHead>
                    <TableHead className="text-white font-bold">Ação</TableHead>
                    <TableHead className="text-white font-bold">Detalhes</TableHead>
                    <TableHead className="text-white font-bold">Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsList?.map((l) => (
                    <TableRow key={l.id} className="border-neutral-800">
                      <TableCell className="font-mono text-white">#{l.id}</TableCell>
                      <TableCell><Badge className="bg-neutral-800 text-white font-mono">{l.action}</Badge></TableCell>
                      <TableCell className="text-white">{l.details}</TableCell>
                      <TableCell className="text-xs text-white">{new Date(l.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResellerDashboard() {
  const { data, refetch } = trpc.reseller.dashboard.useQuery();
  const [newClientUser, setNewClientUser] = useState("");
  const [newClientPass, setNewClientPass] = useState("");
  const [newClientType, setNewClientType] = useState<"basic" | "advanced">("basic");
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);

  const createClientMutation = trpc.reseller.createClient.useMutation({
    onSuccess: (res) => {
      toast.success("Cliente criado com sucesso! 1 crédito consumido.");
      setCreatedCredentials({ username: res.createdUsername, password: res.createdPassword });
      setNewClientUser("");
      setNewClientPass("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteClientMutation = trpc.reseller.deleteClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido e Key devolvida.");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPassMutation = trpc.reseller.editClientPassword.useMutation({
    onSuccess: () => toast.success("Senha alterada!"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-white">Créditos Proxy Basic</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-black text-red-600">{data?.creditsBasic || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-white">Créditos Proxy Advanced</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-black text-amber-400">{data?.creditsAdvanced || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-white">Total Clientes Criados</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-bold text-white">{data?.clientsCount || 0}</div></CardContent>
        </Card>
      </div>

      {createdCredentials && (
        <Card className="bg-red-950/40 border-red-800 text-white p-4">
          <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Cliente Criado com Sucesso!</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-white">Copie as credenciais abaixo para enviar ao seu cliente (A Key é atribuída automaticamente pelo sistema e visível apenas no painel do cliente):</p>
            <div className="bg-black/60 p-3 rounded font-mono text-sm space-y-1">
              <div>Usuário: <strong className="text-white">{createdCredentials.username}</strong></div>
              <div>Senha: <strong className="text-white">{createdCredentials.password}</strong></div>
              <div>Link de ativação: <strong className="text-blue-400">https://shelbypainel-production.up.railway.app</strong></div>
            </div>
            <Button className="bg-red-600 hover:bg-red-700 text-white mt-2" onClick={() => {
              navigator.clipboard.writeText(`Usuário: ${createdCredentials.username}\nSenha: ${createdCredentials.password}\nLink de ativação: https://shelbypainel-production.up.railway.app`);
              toast.success("Credenciais copiadas!");
            }}>
              <Copy className="w-4 h-4 mr-2" /> Copiar Credenciais Completas
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader><CardTitle className="text-white">Criar Novo Cliente (Consome 1 Crédito)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="text-xs text-white font-semibold block mb-1">Tipo de Gerador</label>
              <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={newClientType} onChange={(e: any) => setNewClientType(e.target.value)}>
                <option value="basic">Proxy Android Basic</option>
                <option value="advanced">Proxy Android Advanced</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white font-semibold block mb-1">Usuário do Cliente</label>
              <Input className="bg-[#222] border-neutral-700 text-white" value={newClientUser} onChange={(e) => setNewClientUser(e.target.value)} placeholder="cliente1" />
            </div>
            <div>
              <label className="text-xs text-white font-semibold block mb-1">Senha do Cliente</label>
              <Input type="password" className="bg-[#222] border-neutral-700 text-white" value={newClientPass} onChange={(e) => setNewClientPass(e.target.value)} placeholder="senha" />
            </div>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => createClientMutation.mutate({ username: newClientUser, password: newClientPass, type: newClientType })}>
              <UserPlus className="w-4 h-4 mr-1" /> Gerar Key ({newClientType === "advanced" ? "Advanced" : "Basic"})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader><CardTitle className="text-white">Seus Clientes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table>
            <TableHeader>
              <TableRow className="border-neutral-800">
                <TableHead className="text-white font-bold">ID</TableHead>
                <TableHead className="text-white font-bold">Usuário</TableHead>
                <TableHead className="text-white font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.clients?.map((c) => (
                <TableRow key={c.id} className="border-neutral-800">
                  <TableCell className="font-mono text-white">#{c.id}</TableCell>
                  <TableCell className="font-bold text-white">{c.username}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => {
                      const p = prompt("Nova senha:");
                      if (p) resetPassMutation.mutate({ clientId: c.id, newPassword: p });
                    }}>Senha</Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm("Excluir cliente?")) deleteClientMutation.mutate({ clientId: c.id });
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClientDashboard() {
  const { data } = trpc.clientPanel.dashboard.useQuery();
  const [copied, setCopied] = useState(false);

  const [countdown, setCountdown] = useState(5);
  const [showAlert, setShowAlert] = useState(true);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowAlert(false);
    }
  }, [countdown]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-white">
      {showAlert && (
        <Card className="bg-[#141414] border-red-600/50 text-white p-4 animate-fade-in shadow-xl">
          <div className="flex items-center gap-3 text-red-500 font-bold mb-2">
            <AlertTriangle className="w-6 h-6" />
            <span>Aviso Importante ({countdown}s)</span>
          </div>
          <p className="text-xs text-white mb-3">
            Aguarde... Se você comprou com revendedores não autorizados da Shelby, denuncie aqui:
          </p>
          <a
            href="https://discord.gg/YYBZxhhm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
          >
            Entre Aqui
          </a>
        </Card>
      )}

      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader><CardTitle className="text-white">Suas Informações de Acesso</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1f1f1f] p-4 rounded-lg border border-neutral-800">
              <span className="text-xs text-white font-bold block mb-1">SEU USUÁRIO</span>
              <strong className="text-lg text-white font-mono">{data?.username}</strong>
            </div>
            <div className="bg-[#1f1f1f] p-4 rounded-lg border border-neutral-800">
              <span className="text-xs text-white font-bold block mb-1">SUA KEY DE ACESSO</span>
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-mono font-bold text-sm">{data?.keyValue ? data.keyValue : "Nenhuma Key vinculada"}</span>
                {data?.keyValue ? (
                  <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800 shrink-0 ml-2" onClick={() => {
                    navigator.clipboard.writeText(data.keyValue || "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast.success("Key copiada!");
                  }}>
                    <Copy className="w-3 h-3 mr-1" /> {copied ? "Copiado" : "Copiar"}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="bg-[#1f1f1f] p-4 rounded-lg border border-neutral-800 flex flex-col justify-between">
              <span className="text-xs text-white font-bold block mb-1">SUPORTE E COMUNIDADE</span>
              <a
                href="https://discord.gg/YYBZxhhm"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold px-4 py-2 rounded-lg transition"
              >
                Entrar no Discord
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DOWNLOADS */}
      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><FileDown className="w-5 h-5 text-red-600" /> Downloads Disponíveis</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data?.downloads?.length === 0 ? (
              <p className="text-sm text-white">Nenhum download cadastrado no momento.</p>
            ) : (
              data?.downloads?.map((d) => (
                <div key={d.id} className="bg-[#1f1f1f] border border-neutral-800 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-white font-bold">{d.title}</strong>
                      <Badge className="bg-neutral-800 text-white border-neutral-700">v{d.version}</Badge>
                    </div>
                    {d.description && <p className="text-xs text-white">{d.description}</p>}
                  </div>
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto">
                      <DownloadIcon className="w-4 h-4 mr-2" /> Baixar
                    </Button>
                  </a>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* TUTORIAIS */}
      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><BookOpen className="w-5 h-5 text-red-600" /> Tutoriais e Vídeos Explicativos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data?.tutorials?.length === 0 ? (
              <p className="text-sm text-white">Nenhum tutorial cadastrado no momento.</p>
            ) : (
              data?.tutorials?.map((t) => (
                <div key={t.id} className="bg-[#1f1f1f] border border-neutral-800 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <strong className="text-white font-bold text-base">{t.title}</strong>
                    {t.description && <p className="text-xs text-white">{t.description}</p>}
                  </div>
                  <a href={t.videoUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto">
                      <Video className="w-4 h-4 mr-2" /> Assistir / Acessar Tutorial
                    </Button>
                  </a>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
