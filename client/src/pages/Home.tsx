import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Key, Download, Users, UserPlus, LogOut, RefreshCcw, Lock, Unlock, Trash2, Plus, Copy, Check, Activity, Edit, FileText, Power, AlertTriangle } from "lucide-react";

export default function Home() {
  const utils = trpc.useUtils();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [deviceIdentifier] = useState(() => "device_" + Math.random().toString(36).substring(7));

  // Alerta de 5 segundos para clientes
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

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-red-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/20 blur-[140px] rounded-full pointer-events-none"></div>

        {/* Alerta de aviso para clientes */}
        {showAlert && (
          <div className="w-full max-w-md bg-zinc-900 border border-red-600/50 p-4 rounded-xl shadow-2xl mb-4 text-center relative z-10 animate-fade-in">
          <div className="flex items-center justify-center gap-2 text-red-500 font-bold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Aviso Importante ({countdown}s)</span>
          </div>
          <p className="text-xs text-neutral-300 mb-3">
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
          </div>
        )}

        <div className="w-full max-w-md bg-[#000000]/80 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-xl relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-wider text-red-600 uppercase">Shelby Panel</h1>
            <p className="text-sm text-neutral-400 mt-2">Painel de Acesso & Distribuição</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate({ username: loginUsername, password: loginPassword, deviceIdentifier });
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-1 block">Usuário</label>
              <Input
                className="bg-[#1f1f1f] border-neutral-800 text-white focus:border-red-600"
                placeholder="Ex: seu login"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-1 block">Senha</label>
              <Input
                type="password"
                className="bg-[#1f1f1f] border-neutral-800 text-white focus:border-red-600"
                placeholder="••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 mt-2" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Entrando..." : "Entrar na Plataforma"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#000000]/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-red-600 tracking-wider">SHELBY PANEL</h1>
          <Badge variant="outline" className="border-red-600 text-red-500 uppercase text-xs font-bold">
            {user.role}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-300 font-medium">Logado como: <strong className="text-white">{user.username}</strong></span>
          <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()} className="text-red-500 hover:text-red-400 hover:bg-red-950/30">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {user.role === "moderator" && <ModeratorDashboard />}
        {user.role === "reseller" && <ResellerDashboard />}
        {user.role === "client" && <ClientDashboard />}
      </main>
    </div>
  );
}

function ModeratorDashboard() {
  const { data: stats, refetch: refetchStats } = trpc.moderator.dashboardStats.useQuery();
  const { data: resellers, refetch: refetchResellers } = trpc.moderator.listResellers.useQuery();
  const { data: clients, refetch: refetchClients } = trpc.moderator.listClients.useQuery();
  const { data: keysList, refetch: refetchKeys } = trpc.moderator.listKeys.useQuery();
  const { data: downloadsList, refetch: refetchDownloads } = trpc.moderator.listDownloads.useQuery();
  const { data: logsList } = trpc.moderator.listLogs.useQuery();

  const [newResellerUser, setNewResellerUser] = useState("");
  const [newResellerPass, setNewResellerPass] = useState("");
  const [newResellerCredits, setNewResellerCredits] = useState(10);

  const [newKeyVal, setNewKeyVal] = useState("");
  const [batchKeysText, setBatchKeysText] = useState("");

  const [dlTitle, setDlTitle] = useState("");
  const [dlDesc, setDlDesc] = useState("");
  const [dlVersion, setDlVersion] = useState("1.0.0");
  const [dlUrl, setDlUrl] = useState("");

  const [editingDownload, setEditingDownload] = useState<any | null>(null);

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

  const resetPasswordMutation = trpc.moderator.resetUserPassword.useMutation({
    onSuccess: () => toast.success("Senha resetada!"),
  });

  const deleteUserMutation = trpc.moderator.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído.");
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
    onSuccess: (res: { success: boolean; added: number }) => {
      toast.success(`${res.added} keys importadas com sucesso!`);
      setBatchKeysText("");
      refetchKeys();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleKeyMutation = trpc.moderator.toggleKeyStatus.useMutation({
    onSuccess: () => {
      toast.success("Status da Key alterado!");
      refetchKeys();
    },
  });

  const deleteKeyMutation = trpc.moderator.deleteKey.useMutation({
    onSuccess: () => {
      toast.success("Key removida.");
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
  });

  const deleteDownloadMutation = trpc.moderator.deleteDownload.useMutation({
    onSuccess: () => {
      toast.success("Download removido.");
      refetchDownloads();
    },
  });

  const exportKeys = () => {
    if (!keysList) return;
    const textData = keysList.map(k => `${k.keyValue} | ${k.isUsed ? 'Usada' : 'Disponível'} | ${k.isActive ? 'Ativa' : 'Inativa'}`).join('\n');
    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keys_export.txt';
    a.click();
    toast.success("Keys exportadas com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#1f1f1f] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Total Clientes</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalClients || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#1f1f1f] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Total Revendedores</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalResellers || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#1f1f1f] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Keys Usadas / Totais</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.usedKeys || 0} / {stats?.totalKeys || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#1f1f1f] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Sessões Ativas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-500">{stats?.activeSessions || 0}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resellers" className="space-y-4">
        <TabsList className="bg-[#1a1a1a] border border-neutral-800 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="resellers" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Revendedores</TabsTrigger>
          <TabsTrigger value="clients" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Clientes</TabsTrigger>
          <TabsTrigger value="keys" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Gerenciar Keys</TabsTrigger>
          <TabsTrigger value="downloads" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Downloads</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Logs de Auditoria</TabsTrigger>
        </TabsList>

        {/* REVENDEDORES */}
        <TabsContent value="resellers" className="space-y-4">
          <Card className="bg-[#181818] border-neutral-800 text-white">
            <CardHeader><CardTitle>Criar Novo Revendedor</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Usuário</label>
                  <Input className="bg-[#222] border-neutral-700 text-white" value={newResellerUser} onChange={(e) => setNewResellerUser(e.target.value)} placeholder="revendedor1" />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Senha</label>
                  <Input type="password" className="bg-[#222] border-neutral-700 text-white" value={newResellerPass} onChange={(e) => setNewResellerPass(e.target.value)} placeholder="senha" />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Créditos Iniciais</label>
                  <Input type="number" className="bg-[#222] border-neutral-700 text-white w-28" value={newResellerCredits} onChange={(e) => setNewResellerCredits(Number(e.target.value))} />
                </div>
                <Button className="bg-red-600 hover:bg-red-700" onClick={() => createResellerMutation.mutate({ username: newResellerUser, password: newResellerPass, credits: newResellerCredits })}>
                  <Plus className="w-4 h-4 mr-1" /> Criar Revendedor
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-neutral-800 text-white">
            <CardHeader><CardTitle>Lista de Revendedores</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-neutral-400">ID</TableHead>
                    <TableHead className="text-neutral-400">Usuário</TableHead>
                    <TableHead className="text-neutral-400">Créditos</TableHead>
                    <TableHead className="text-neutral-400">Status</TableHead>
                    <TableHead className="text-neutral-400 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resellers?.map((r) => (
                    <TableRow key={r.id} className="border-neutral-800">
                      <TableCell className="font-mono">#{r.id}</TableCell>
                      <TableCell className="font-bold">{r.username}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-500">{r.credits}</span>
                          <Button size="sm" variant="outline" className="h-7 px-2 border-neutral-700 bg-transparent" onClick={() => {
                            const val = prompt(`Adicionar/Remover créditos para ${r.username} (Use valor positivo para adicionar ou negativo para remover):`);
                            if (val) {
                              const num = Number(val);
                              updateCreditsMutation.mutate({ resellerId: r.id, credits: Math.abs(num), action: num >= 0 ? "add" : "remove" });
                            }
                          }}>± Créditos</Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={r.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-red-950 text-red-400 border-red-800"}>
                          {r.isActive ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => toggleStatusMutation.mutate({ userId: r.id })}>
                          {r.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => resetSessionMutation.mutate({ userId: r.id })}>
                          <RefreshCcw className="w-3 h-3" /> Sessão
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => {
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
          <Card className="bg-[#181818] border-neutral-800 text-white">
            <CardHeader><CardTitle>Todos os Clientes do Sistema</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-neutral-400">ID</TableHead>
                    <TableHead className="text-neutral-400">Usuário</TableHead>
                    <TableHead className="text-neutral-400">Key Atribuída</TableHead>
                    <TableHead className="text-neutral-400">Revendedor</TableHead>
                    <TableHead className="text-neutral-400">Status</TableHead>
                    <TableHead className="text-neutral-400 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients?.map((c) => (
                    <TableRow key={c.id} className="border-neutral-800">
                      <TableCell className="font-mono">#{c.id}</TableCell>
                      <TableCell className="font-bold">{c.username}</TableCell>
                      <TableCell className="font-mono text-xs text-amber-400">{c.keyValue}</TableCell>
                      <TableCell>{c.resellerName}</TableCell>
                      <TableCell>
                        <Badge className={c.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-red-950 text-red-400 border-red-800"}>
                          {c.isActive ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => toggleStatusMutation.mutate({ userId: c.id })}>
                          {c.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => resetSessionMutation.mutate({ userId: c.id })}>
                          <RefreshCcw className="w-3 h-3" /> Sessão
                        </Button>
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => {
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
            <Card className="bg-[#181818] border-neutral-800 text-white">
              <CardHeader><CardTitle>Adicionar Key Individual</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Ex: SHELBY-XXXX-YYYY" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} />
                <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal })}>
                  Adicionar Key
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#181818] border-neutral-800 text-white">
              <CardHeader><CardTitle>Importar Keys em Lote (.txt)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Cole uma key por linha..." value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} />
                <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n") })}>
                  Importar em Lote
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#181818] border-neutral-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Todas as Keys do Sistema</CardTitle>
              <Button size="sm" className="bg-neutral-800 hover:bg-neutral-700 text-white" onClick={exportKeys}>
                Exportar Keys (.txt)
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-neutral-400">ID</TableHead>
                    <TableHead className="text-neutral-400">Key Value</TableHead>
                    <TableHead className="text-neutral-400">Status Uso</TableHead>
                    <TableHead className="text-neutral-400">Estado Ativação</TableHead>
                    <TableHead className="text-neutral-400 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysList?.map((k) => (
                    <TableRow key={k.id} className="border-neutral-800">
                      <TableCell className="font-mono">#{k.id}</TableCell>
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
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => toggleKeyMutation.mutate({ keyId: k.id })}>
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
        </TabsContent>

        {/* DOWNLOADS */}
        <TabsContent value="downloads" className="space-y-4">
          <Card className="bg-[#181818] border-neutral-800 text-white">
            <CardHeader><CardTitle>{editingDownload ? "Editar Download" : "Cadastrar Novo Download"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={editingDownload ? editingDownload.title : dlTitle} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, title: e.target.value}) : setDlTitle(e.target.value)} />
                <Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={editingDownload ? editingDownload.version : dlVersion} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, version: e.target.value}) : setDlVersion(e.target.value)} />
              </div>
              <Input className="bg-[#222] border-neutral-700 text-white" placeholder="URL de Download" value={editingDownload ? editingDownload.fileUrl : dlUrl} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, fileUrl: e.target.value}) : setDlUrl(e.target.value)} />
              <textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" placeholder="Descrição..." value={editingDownload ? (editingDownload.description || "") : dlDesc} onChange={(e) => editingDownload ? setEditingDownload({...editingDownload, description: e.target.value}) : setDlDesc(e.target.value)} />
              
              <div className="flex gap-2">
                {editingDownload ? (
                  <>
                    <Button className="bg-red-600 hover:bg-red-700 flex-1" onClick={() => updateDownloadMutation.mutate(editingDownload)}>
                      Salvar Alterações
                    </Button>
                    <Button variant="outline" className="border-neutral-700 text-white" onClick={() => setEditingDownload(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button className="bg-red-600 hover:bg-red-700 w-full" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl })}>
                    Cadastrar Download
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-neutral-800 text-white">
            <CardHeader><CardTitle>Downloads Cadastrados</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-neutral-400">Título</TableHead>
                    <TableHead className="text-neutral-400">Versão</TableHead>
                    <TableHead className="text-neutral-400">Link</TableHead>
                    <TableHead className="text-neutral-400 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloadsList?.map((d) => (
                    <TableRow key={d.id} className="border-neutral-800">
                      <TableCell className="font-bold">{d.title}</TableCell>
                      <TableCell>{d.version}</TableCell>
                      <TableCell className="text-blue-400 truncate max-w-xs">{d.fileUrl}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => setEditingDownload(d)}>
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

        {/* LOGS */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="bg-[#181818] border-neutral-800 text-white">
            <CardHeader><CardTitle>Logs de Auditoria do Sistema</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-neutral-400">ID</TableHead>
                    <TableHead className="text-neutral-400">Ação</TableHead>
                    <TableHead className="text-neutral-400">Detalhes</TableHead>
                    <TableHead className="text-neutral-400">Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsList?.map((l) => (
                    <TableRow key={l.id} className="border-neutral-800">
                      <TableCell className="font-mono">#{l.id}</TableCell>
                      <TableCell><Badge className="bg-neutral-800 text-white font-mono">{l.action}</Badge></TableCell>
                      <TableCell className="text-neutral-300">{l.details}</TableCell>
                      <TableCell className="text-xs text-neutral-500">{new Date(l.createdAt).toLocaleString()}</TableCell>
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
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string; keyValue: string } | null>(null);

  const createClientMutation = trpc.reseller.createClient.useMutation({
    onSuccess: (res) => {
      toast.success("Cliente criado com sucesso! 1 crédito consumido.");
      setCreatedCredentials({ username: res.createdUsername, password: res.createdPassword, keyValue: res.keyValue });
      setNewClientUser("");
      setNewClientPass("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#1f1f1f] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Créditos Disponíveis</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-black text-red-600">{data?.credits || 0}</div></CardContent>
        </Card>
        <Card className="bg-[#1f1f1f] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-neutral-400">Total Clientes Criados</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-bold">{data?.clientsCount || 0}</div></CardContent>
        </Card>
      </div>

      {createdCredentials && (
        <Card className="bg-red-950/40 border-red-800 text-white p-4">
          <CardHeader className="pb-2"><CardTitle className="text-red-400 text-sm">Cliente Criado com Sucesso!</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-neutral-300">Copie as credenciais abaixo para enviar ao seu cliente (A Key foi vinculada automaticamente e permanece invisível no sistema para revendedores):</p>
            <div className="bg-black/60 p-3 rounded font-mono text-sm space-y-1">
              <div>Usuário: <strong className="text-white">{createdCredentials.username}</strong></div>
              <div>Senha: <strong className="text-white">{createdCredentials.password}</strong></div>
              <div>Key Vinculada: <strong className="text-amber-400">{createdCredentials.keyValue}</strong></div>
            </div>
            <Button className="bg-red-600 hover:bg-red-700 mt-2" onClick={() => {
              navigator.clipboard.writeText(`Usuário: ${createdCredentials.username}\nSenha: ${createdCredentials.password}\nKey: ${createdCredentials.keyValue}`);
              toast.success("Credenciais copiadas!");
            }}>
              <Copy className="w-4 h-4 mr-2" /> Copiar Credenciais Completas
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#181818] border-neutral-800 text-white">
        <CardHeader><CardTitle>Criar Novo Cliente (Consome 1 Crédito)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Usuário do Cliente</label>
              <Input className="bg-[#222] border-neutral-700 text-white" value={newClientUser} onChange={(e) => setNewClientUser(e.target.value)} placeholder="cliente1" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Senha do Cliente</label>
              <Input type="password" className="bg-[#222] border-neutral-700 text-white" value={newClientPass} onChange={(e) => setNewClientPass(e.target.value)} placeholder="senha" />
            </div>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => createClientMutation.mutate({ username: newClientUser, password: newClientPass })}>
              <UserPlus className="w-4 h-4 mr-1" /> Criar Cliente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#181818] border-neutral-800 text-white">
        <CardHeader><CardTitle>Seus Clientes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table>
            <TableHeader>
              <TableRow className="border-neutral-800">
                <TableHead className="text-neutral-400">ID</TableHead>
                <TableHead className="text-neutral-400">Usuário</TableHead>
                <TableHead className="text-neutral-400">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.clients?.map((c) => (
                <TableRow key={c.id} className="border-neutral-800">
                  <TableCell className="font-mono">#{c.id}</TableCell>
                  <TableCell className="font-bold">{c.username}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent" onClick={() => {
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="bg-[#181818] border-neutral-800 text-white">
        <CardHeader>
          <CardTitle>Suas Credenciais & Key</CardTitle>
          <CardDescription className="text-neutral-400">Sua Key de acesso atribuída automaticamente pelo sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between bg-[#222] p-4 rounded-xl border border-neutral-800 flex-wrap gap-4">
            <div>
              <span className="text-xs text-neutral-400 block uppercase">Usuário</span>
              <span className="text-lg font-bold">{data?.username}</span>
            </div>
            <div>
              <span className="text-xs text-neutral-400 block uppercase">Key Atribuída</span>
              <span className="text-lg font-mono font-bold text-amber-400">{data?.keyValue}</span>
            </div>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                navigator.clipboard.writeText(`Usuário: ${data?.username} | Key: ${data?.keyValue}`);
                setCopied(true);
                toast.success("Credenciais copiadas!");
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#181818] border-neutral-800 text-white">
        <CardHeader>
          <CardTitle>Downloads Disponíveis</CardTitle>
          <CardDescription className="text-neutral-400">Softwares e arquivos cadastrados pelo Moderador.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.downloads?.map((d) => (
              <div key={d.id} className="bg-[#222] border border-neutral-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{d.title}</h3>
                    <Badge variant="outline" className="border-neutral-700 text-neutral-300">v{d.version}</Badge>
                  </div>
                  <p className="text-sm text-neutral-400 mb-4">{d.description || "Sem descrição."}</p>
                </div>
                <Button className="w-full bg-red-600 hover:bg-red-700 font-bold" onClick={() => window.open(d.fileUrl, "_blank")}>
                  <Download className="w-4 h-4 mr-2" /> Baixar Arquivo
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
