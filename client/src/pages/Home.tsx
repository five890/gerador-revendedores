import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Lock, Unlock, RefreshCcw, Trash2, Power, UserPlus, Copy, Download as DownloadIcon, Edit, LogOut, Shield, Users, KeyRound, FileDown, BookOpen, AlertTriangle, Video } from "lucide-react";

function getVideoEmbedUrl(rawUrl: string): { kind: "iframe" | "video"; url: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return { kind: "iframe", url: `https://www.youtube.com/embed/${parsed.pathname.slice(1).split("/")[0]}` };
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v") || parsed.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      if (id) return { kind: "iframe", url: `https://www.youtube.com/embed/${id}` };
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return { kind: "iframe", url: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|ogg|mov)(?:\?.*)?$/i.test(parsed.pathname)) return { kind: "video", url: parsed.toString() };
  } catch {
    return null;
  }
  return null;
}

export default function Home() {
  const utils = trpc.useUtils();
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });



  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityHidden, setSecurityHidden] = useState(false);

  useEffect(() => {
    if (!user) return;
    const blockInteraction = (event: MouseEvent) => event.preventDefault();
    const blockShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blocked = event.key === "PrintScreen" || event.key === "F12" ||
        ((event.ctrlKey || event.metaKey) && ["p", "s", "u", "c"].includes(key)) ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && ["i", "j", "c"].includes(key));
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onVisibility = () => setSecurityHidden(document.visibilityState !== "visible");
    const onBlur = () => setSecurityHidden(true);
    const onFocus = () => setSecurityHidden(false);
    document.addEventListener("contextmenu", blockInteraction);
    document.addEventListener("keydown", blockShortcuts, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("contextmenu", blockInteraction);
      document.removeEventListener("keydown", blockShortcuts, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

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
          <div className="border-t border-neutral-800 pt-4 text-center space-y-2">
            <p className="text-xs text-neutral-400">Entre no nosso Discord oficial</p>
            <a href="https://discord.gg/shelbys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full rounded-md border border-indigo-700 bg-indigo-950/40 px-4 py-2 text-sm font-bold text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors">
              Entrar no Discord Oficial
            </a>
            <p className="text-[11px] font-semibold text-amber-400">Atenção: abra este link em um navegador como Chrome ou Safari.</p>
          </div>
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

      {securityHidden && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505] text-center p-6">
          <div><Shield className="mx-auto mb-3 h-10 w-10 text-red-500" /><p className="text-lg font-bold text-white">Conteúdo protegido</p><p className="mt-1 text-sm text-neutral-400">Retorne a esta janela para continuar visualizando o painel.</p></div>
        </div>
      )}
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
  const { data: resellerLogsList } = trpc.moderator.listResellerLogs.useQuery();
  const { data: resellerKeyAudit } = trpc.moderator.keyAuditByReseller.useQuery();

  const utils = trpc.useUtils();

  const [newResellerUser, setNewResellerUser] = useState("");
  const [newResellerPass, setNewResellerPass] = useState("");
  const [newResellerCreditsBasic, setNewResellerCreditsBasic] = useState(10);
  const [newResellerCreditsAdvanced, setNewResellerCreditsAdvanced] = useState(10);
  const [newResellerCreditsIos, setNewResellerCreditsIos] = useState(10);
  const [newResellerCreditsPanelIos, setNewResellerCreditsPanelIos] = useState(0);
  const [newResellerCreditsPanelLegitimo, setNewResellerCreditsPanelLegitimo] = useState(0);
  const [newResellerIsPremium, setNewResellerIsPremium] = useState(false);

  const [newKeyVal, setNewKeyVal] = useState("");
  const [newKeyType, setNewKeyType] = useState<"basic" | "advanced" | "ios" | "panel_ios" | "panel_legitimo">("advanced");
  const [batchKeysText, setBatchKeysText] = useState("");
  const [batchKeyType, setBatchKeyType] = useState<"basic" | "advanced" | "ios" | "panel_ios" | "panel_legitimo">("advanced");

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

  const [modClientUser, setModClientUser] = useState("");
  const [modClientPass, setModClientPass] = useState("");
  const [modClientType, setModClientType] = useState<"basic" | "advanced" | "ios" | "panel_ios" | "panel_legitimo">("advanced");
  const [modClientMaxDevices, setModClientMaxDevices] = useState(1);
  const [keysRevealed, setKeysRevealed] = useState(false);
  const [modCreatedCredentials, setModCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [modRenewingClient, setModRenewingClient] = useState<{ id: number; username: string } | null>(null);
  const [modClientSearch, setModClientSearch] = useState("");
  const [keyAuditType, setKeyAuditType] = useState<"all" | "basic" | "advanced" | "ios" | "panel_ios" | "panel_legitimo">("all");
  const [keyAuditSearch, setKeyAuditSearch] = useState("");
  const [keyAuditFrom, setKeyAuditFrom] = useState("");
  const [keyAuditTo, setKeyAuditTo] = useState("");


  const deleteExpiredKeysMutation = trpc.moderator.deleteExpiredKeys.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deletedCount} chaves expiradas excluídas com sucesso!`);
      refetchKeys();
    },
    onError: (err) => toast.error(err.message),
  });
  const [modRenewType, setModRenewType] = useState<"basic" | "advanced" | "ios" | "panel_ios" | "panel_legitimo">("advanced");

  const modCreateClientMutation = trpc.moderator.createClient.useMutation({
    onSuccess: (res) => {
      toast.success(`Cliente ${res.createdUsername} criado com sucesso pelo Moderador!`);
      setModCreatedCredentials({ username: res.createdUsername, password: res.createdPassword });
      setModClientUser("");
      setModClientPass("");
      setModClientMaxDevices(1);
      refetchClients();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const modRenewClientMutation = trpc.reseller.renewClient.useMutation({
    onSuccess: (res) => {
      toast.success(`Cliente renovado com sucesso! Nova Key atribuída: ${res.newKeyValue}`);
      refetchClients();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const modAddHoursMutation = trpc.reseller.addHours.useMutation({
    onSuccess: () => {
      toast.success("Horas adicionadas sem renovar a key!");
      refetchClients();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateClientMaxDevicesMutation = trpc.moderator.updateClientMaxDevices.useMutation({
    onSuccess: () => {
      toast.success("Limite de dispositivos atualizado!");
      refetchClients();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createResellerMutation = trpc.moderator.createReseller.useMutation({
    onSuccess: () => {
      toast.success("Revendedor criado com sucesso!");
      setNewResellerUser("");
      setNewResellerPass("");
      setNewResellerIsPremium(false);
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

  const updateResellerProductsMutation = trpc.moderator.updateResellerProducts.useMutation({
    onSuccess: () => { toast.success("Produtos do revendedor atualizados!"); refetchResellers(); },
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
      toast.success("Key adicionada ao estoque!");
      setNewKeyVal("");
      refetchKeys();
      utils.moderator.dashboardStats.invalidate();
    },
    onError: (e) => toast.error(`Não foi possível adicionar: ${e.message}`),
  });

  const batchAddKeysMutation = trpc.moderator.importKeysBatch.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.added} Key(s) adicionada(s). ${res.skipped || 0} duplicada(s) ignorada(s).`);
      setBatchKeysText("");
      refetchKeys();
      utils.moderator.dashboardStats.invalidate();
    },
    onError: (e: any) => toast.error(`Não foi possível importar: ${e.message}`),
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

  const deleteHgKeysMutation = trpc.moderator.deleteHgKeys.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.deletedCount} keys iniciadas com 'HG' foram removidas com sucesso!`);
      refetchKeys();
    },
    onError: (e) => toast.error(e.message),
  });

  const forceRotateIosMutation = trpc.moderator.forceRotateIos.useMutation({
    onSuccess: (res) => {
      if (res.lowStock) {
        toast.warning(`Rotação iOS forçada. ALERTA: Estoque baixo (${res.availableCount} keys disponíveis)!`);
      } else {
        toast.success(`Rotação iOS forçada com sucesso! Keys livres disponíveis: ${res.availableCount}.`);
      }
      refetchKeys();
    },
    onError: (e) => toast.error(e.message),
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

      {(() => {
        if (!stats) return null;
        const stockLabels: Record<string, string> = { basic: "Proxy Basic", advanced: "Proxy Advanced", ios: "Proxy iOS", panel_ios: "Painel iOS", panel_legitimo: "Painel Legítimo", panel_android: "Painel Android", ios_ipa: "Proxy iOS IPA" };
        const lowStock = Object.entries(stockLabels).filter(([type]) => Number((stats?.stock as any)?.[type] || 0) <= 3);
        const lowStockTotal = lowStock.reduce((sum, [type]) => sum + Number((stats?.stock as any)?.[type] || 0), 0);
        return <Card className="bg-[#141414] border-neutral-800 text-white"><CardContent className="p-4"><div className="flex items-start gap-3"><KeyRound className="w-6 h-6 text-amber-400 mt-0.5 shrink-0" /><div className="w-full"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-lg text-white">Estoque disponível de Keys</p>{lowStock.length > 0 && <Badge className="bg-red-900/70 border-red-600 text-red-100"><AlertTriangle className="w-3 h-3 mr-1" /> {lowStock.length} tipo(s) em estoque baixo</Badge>}</div><p className="text-xs text-neutral-400 mt-1">Quantidade atual de Keys ativas, não usadas e não banidas.</p><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-3">{Object.entries(stockLabels).map(([type, label]) => { const count = Number((stats?.stock as any)?.[type] || 0); const isLow = count <= 3; return <div key={type} className={`rounded-md border px-3 py-2 ${isLow ? "border-red-600 bg-red-950/60" : "border-neutral-700 bg-[#202020]"}`}><p className={`text-xs font-bold ${isLow ? "text-red-200" : "text-neutral-300"}`}>{label}</p><p className={`text-lg font-black ${isLow ? "text-red-400" : "text-emerald-400"}`}>{count} Keys disponíveis</p></div>; })}</div>{lowStock.length > 0 && <p className="text-xs font-bold text-red-300 mt-3"><AlertTriangle className="w-3 h-3 inline mr-1" /> Atenção: {lowStockTotal} Keys somadas estão em tipos com estoque de 3 ou menos. Reponha o estoque.</p>}</div></div></CardContent></Card>;
      })()}

      <Tabs defaultValue="resellers" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <div className="mb-2"><h2 className="text-sm font-black uppercase tracking-wider text-white">Centro de Controle do Moderador</h2><p className="text-xs text-neutral-500">Gerencie usuários, painéis, estoque, conteúdo e auditoria em seções separadas.</p></div>
          <TabsList className="bg-[#141414] border border-neutral-800 p-2 flex flex-wrap items-center gap-1 w-full h-auto">
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Operação</span>
            <TabsTrigger value="resellers" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Revendedores</TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Clientes</TabsTrigger>
            <span className="mx-1 h-5 w-px bg-neutral-700" />
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Painéis</span>
            <TabsTrigger value="iosPanel" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white">Painel iOS</TabsTrigger>
            <TabsTrigger value="legitPanel" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-white">Painel Legítimo</TabsTrigger>
            <TabsTrigger value="androidPanel" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white">Painel Android</TabsTrigger>
            <TabsTrigger value="iosIpaPanel" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white">Proxy iOS IPA</TabsTrigger>
            <span className="mx-1 h-5 w-px bg-neutral-700" />
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Keys</span>
            <TabsTrigger value="androidKeys" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white">Keys Android</TabsTrigger>
            <TabsTrigger value="iosIpaKeys" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white">Keys iOS IPA</TabsTrigger>
            <TabsTrigger value="legitKeys" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-white">Keys Legítimo</TabsTrigger>
            <TabsTrigger value="keys" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Gerenciar Keys</TabsTrigger>
            <TabsTrigger value="bannedKeys" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Banidas / Usadas</TabsTrigger>
            <span className="mx-1 h-5 w-px bg-neutral-700" />
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Conteúdo e auditoria</span>
            <TabsTrigger value="downloads" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Downloads</TabsTrigger>
            <TabsTrigger value="tutorials" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Tutoriais</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Logs</TabsTrigger>
            <TabsTrigger value="keyAudit" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-white">Keys por Revendedor</TabsTrigger>
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
                  <div>
                    <label className="text-xs text-white font-semibold block mb-1">Créditos Proxy iOS</label>
                    <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsIos} onChange={(e) => setNewResellerCreditsIos(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-white font-semibold block mb-1">Créditos Painel iOS</label>
                    <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsPanelIos} onChange={(e) => setNewResellerCreditsPanelIos(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-white font-semibold block mb-1">Créditos Painel Legítimo</label>
                    <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsPanelLegitimo} onChange={(e) => setNewResellerCreditsPanelLegitimo(Number(e.target.value))} />
                  </div>
                <div className="flex items-center space-x-2 pt-2">
                  <input type="checkbox" id="isPremiumCheck" className="w-4 h-4 rounded border-neutral-700 bg-[#222] text-red-600 focus:ring-red-500" checked={newResellerIsPremium} onChange={(e) => setNewResellerIsPremium(e.target.checked)} />
                  <label htmlFor="isPremiumCheck" className="text-xs font-bold text-amber-400 cursor-pointer">Revendedor Premium (★)</label>
                </div>
                <Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto" onClick={() => createResellerMutation.mutate({ username: newResellerUser, password: newResellerPass, creditsBasic: newResellerCreditsBasic, creditsAdvanced: newResellerCreditsAdvanced, creditsIos: newResellerCreditsIos, creditsPanelIos: newResellerCreditsPanelIos, creditsPanelLegitimo: newResellerCreditsPanelLegitimo, isPremium: newResellerIsPremium })}>
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
                        {[
                          { name: 'basic', label: 'Android Basic', color: 'text-red-500' },
                          { name: 'advanced', label: 'Android Advanced', color: 'text-amber-400' },
                          { name: 'ios', label: 'Proxy iOS', color: 'text-blue-400' },
                          { name: 'panel_ios', label: 'Painel iOS', color: 'text-cyan-400' },
                          { name: 'panel_legitimo', label: 'Painel Legítimo', color: 'text-teal-400' },
                          { name: 'panel_android', label: 'Painel Android', color: 'text-orange-400' },
                          { name: 'ios_ipa', label: 'Proxy iOS IPA', color: 'text-violet-400' }
                        ].map((cat) => (
                          <div key={cat.name} className="text-[10px] font-mono text-white flex items-center gap-1">
                            <span className="opacity-70">{cat.label}:</span>
                            <strong className={cat.color}>
                              {(r.credits as any)?.[cat.name] || 0}
                            </strong>
                            <Button size="sm" variant="ghost" className="text-white p-0 h-auto underline text-[10px]" onClick={() => {
                              const action = prompt(`Adicionar ou remover créditos ${cat.label} para ${r.username}? (add ou remove):`);
                              if (action === "add" || action === "remove") {
                                const val = prompt("Quantidade:");
                                const num = parseInt(val || "0", 10);
                                if (!isNaN(num) && num > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: cat.name as any, action, amount: num });
                              }
                            }}>±</Button>
                          </div>
                        ))}
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
                        <Button size="sm" variant="outline" className="border-violet-700 text-violet-300 bg-violet-950/30" title="Produtos habilitados" onClick={() => {
                          const current = (r.enabledProducts || ["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"]).join(", ");
                          const value = prompt(`Produtos liberados para ${r.username}. Use: basic, advanced, ios, panel_ios, panel_legitimo, panel_android, ios_ipa`, current);
                          if (value !== null) {
                            const allowed = ["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"];
                            const products = value.split(",").map((p) => p.trim()).filter((p) => allowed.includes(p)) as any;
                            updateResellerProductsMutation.mutate({ resellerId: r.id, products });
                          }
                        }}>Produtos</Button>
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
          {modCreatedCredentials && (
            <Card className="bg-red-950/40 border-red-800 text-white p-4">
              <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Cliente Criado com Sucesso pelo Moderador!</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-white">Copie as credenciais abaixo para enviar ao seu cliente:</p>
                <div className="bg-black/60 p-3 rounded font-mono text-sm space-y-1">
                  <div>Usuário: <strong className="text-white">{modCreatedCredentials.username}</strong></div>
                  <div>Senha: <strong className="text-white">{modCreatedCredentials.password}</strong></div>
                  <div>Link de ativação: <strong className="text-blue-400">https://shelbypainel-production.up.railway.app</strong></div>
                </div>
                <Button className="bg-red-600 hover:bg-red-700 text-white mt-2" onClick={() => {
                  navigator.clipboard.writeText(`Usuário: ${modCreatedCredentials.username}\nSenha: ${modCreatedCredentials.password}\nLink de ativação: https://shelbypainel-production.up.railway.app`);
                  toast.success("Credenciais copiadas!");
                }}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar Credenciais Completas
                </Button>
              </CardContent>
            </Card>
          )}

          <Dialog open={!!modRenewingClient} onOpenChange={(open) => !open && setModRenewingClient(null)}>
            <DialogContent className="bg-[#141414] border-neutral-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Renovar Cliente (Moderador): <span className="text-red-500">{modRenewingClient?.username}</span></DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-xs text-white font-semibold block mb-2">Selecione o tipo de proxy para renovação:</label>
                  <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={modRenewType} onChange={(e: any) => setModRenewType(e.target.value)}>
                    <option value="basic">Android Basic</option>
                    <option value="advanced">Android Advanced</option>
                    <option value="ios">Proxy iOS</option>
                    <option value="panel_ios">Painel iOS</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => setModRenewingClient(null)}>Cancelar</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => {
                    if (modRenewingClient) {
                      modRenewClientMutation.mutate({ clientId: modRenewingClient.id, type: modRenewType });
                      setModRenewingClient(null);
                    }
                  }}>Confirmar Renovação</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Criar Novo Cliente (Modo Direto / Moderador)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Tipo de Gerador</label>
                  <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={modClientType} onChange={(e: any) => setModClientType(e.target.value)}>
                    <option value="basic">Android Basic</option>
                    <option value="advanced">Android Advanced</option>
                    <option value="ios">Proxy iOS</option>
                    <option value="panel_ios">Painel iOS</option>
                    <option value="panel_legitimo">Painel Legítimo</option>
                <option value="panel_android">Painel Android</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Usuário do Cliente</label>
                  <Input className="bg-[#222] border-neutral-700 text-white" value={modClientUser} onChange={(e) => setModClientUser(e.target.value)} placeholder="cliente_moderador" />
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Senha do Cliente</label>
                  <Input type="password" className="bg-[#222] border-neutral-700 text-white" value={modClientPass} onChange={(e) => setModClientPass(e.target.value)} placeholder="senha" />
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Limite Dispositivos</label>
                  <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={modClientMaxDevices} onChange={(e: any) => setModClientMaxDevices(Number(e.target.value))}>
                    <option value={1}>1 Dispositivo</option>
                    <option value={2}>2 Dispositivos</option>
                    <option value={3}>3 Dispositivos</option>
                    <option value={5}>5 Dispositivos</option>
                    <option value={10}>10 Dispositivos</option>
                  </select>
                </div>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => modCreateClientMutation.mutate({ username: modClientUser, password: modClientPass, type: modClientType, maxDevices: modClientMaxDevices })}>
                  <UserPlus className="w-4 h-4 mr-1" /> Criar Cliente
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Todos os Clientes do Sistema</CardTitle>
              <div className="w-72">
                <Input
                  className="bg-[#222] border-neutral-700 text-white text-sm"
                  placeholder="Pesquisar login do cliente..."
                  value={modClientSearch}
                  onChange={(e) => setModClientSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-white font-bold">ID</TableHead>
                    <TableHead className="text-white font-bold">Usuário</TableHead>
                    <TableHead className="text-white font-bold">Key Atribuída</TableHead>
                    <TableHead className="text-white font-bold">Criado por</TableHead>
                    <TableHead className="text-white font-bold">Status</TableHead>
                    <TableHead className="text-white font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients
                    ?.filter((c) => c.username.toLowerCase().includes(modClientSearch.toLowerCase()))
                    ?.map((c) => (
                    <TableRow key={c.id} className="border-neutral-800">
                      <TableCell className="font-mono text-white">#{c.id}</TableCell>
                      <TableCell className="font-bold text-white">{c.username}</TableCell>
                      <TableCell className="font-mono text-xs text-amber-400">{c.keyValue}</TableCell>
                      <TableCell className="text-white">{c.resellerName}</TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-cyan-400 cursor-pointer underline" title="Alterar limite" onClick={() => {
                          const val = prompt(`Alterar limite de dispositivos para ${c.username} (atual: ${c.maxDevices || 1}):`, String(c.maxDevices || 1));
                          const num = parseInt(val || "", 10);
                          if (!isNaN(num) && num > 0) {
                            updateClientMaxDevicesMutation.mutate({ clientId: c.id, maxDevices: num });
                          }
                        }}>
                          {c.maxDevices || 1} disp.
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={c.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-red-950 text-red-400 border-red-800"}>
                          {c.isActive ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => setModRenewingClient({ id: c.id, username: c.username })}>
                          Renovar
                        </Button>
                        <Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50" onClick={() => {
                          const raw = prompt(`Quantas horas adicionar ao cliente ${c.username}? A key não será renovada:`);
                          const hours = Number(raw);
                          if (Number.isInteger(hours) && hours > 0) modAddHoursMutation.mutate({ clientId: c.id, hours });
                        }}>
                          + Horas
                        </Button>
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

        {/* PAINEL IOS */}
        <TabsContent value="iosPanel" className="space-y-4">
          <Card className="bg-blue-950/30 border-blue-800 text-white">
            <CardHeader><CardTitle className="text-white">Administração completa do Painel iOS</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-blue-100">Tudo cadastrado nesta aba fica vinculado ao tipo <strong>panel_ios</strong>. Os clientes do Painel iOS recebem estes Downloads e Tutoriais no painel deles.</p></CardContent>
          </Card>

          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Créditos do Painel iOS por revendedor</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Créditos Painel iOS</TableHead><TableHead className="text-white font-bold text-right">Ação</TableHead></TableRow></TableHeader><TableBody>
              {resellers?.map((r: any) => <TableRow key={r.id} className="border-neutral-800"><TableCell className="font-bold text-white">{r.username}</TableCell><TableCell className="text-blue-400 font-black">{r.credits?.panel_ios || 0}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300" onClick={() => { const action = prompt(`Para ${r.username}, digite add ou remove:`); if (action === "add" || action === "remove") { const amount = Number(prompt("Quantidade de créditos Painel iOS:")); if (Number.isInteger(amount) && amount > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "panel_ios", action, amount }); } }}>Adicionar/Remover créditos</Button></TableCell></TableRow>)}
            </TableBody></Table></div></CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Key Painel iOS</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Cole a Key do Painel iOS" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} /><Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: "panel_ios" })}>Adicionar Key Painel iOS</Button><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Uma Key do Painel iOS por linha" value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} /><Button className="w-full bg-blue-800 hover:bg-blue-900 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: "panel_ios" })}>Importar Keys Painel iOS</Button></CardContent></Card>
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Download Painel iOS</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título do download Painel iOS" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={dlVersion} onChange={(e) => setDlVersion(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="URL do download" value={dlUrl} onChange={(e) => setDlUrl(e.target.value)} /><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" placeholder="Descrição" value={dlDesc} onChange={(e) => setDlDesc(e.target.value)} /><Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: "panel_ios" })}>Cadastrar Download Painel iOS</Button></CardContent></Card>
            <Card className="bg-[#141414] border-neutral-800 text-white lg:col-span-2"><CardHeader><CardTitle className="text-white">Cadastrar Tutorial Painel iOS</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título do tutorial Painel iOS" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do tutorial ou vídeo" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} /><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" placeholder="Descrição ou instruções" value={tutDesc} onChange={(e) => setTutDesc(e.target.value)} /><Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: "panel_ios" })}>Cadastrar Tutorial Painel iOS</Button></CardContent></Card>
          </div>

          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Conteúdo iOS cadastrado</CardTitle></CardHeader><CardContent className="space-y-4"><div><h4 className="text-sm font-bold text-blue-400 mb-2">Downloads iOS</h4>{downloadsList?.filter((d: any) => d.type === "panel_ios").map((d: any) => <div key={d.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm"><span>{d.title} — v{d.version}</span><Button size="sm" variant="destructive" onClick={() => deleteDownloadMutation.mutate({ downloadId: d.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div><div><h4 className="text-sm font-bold text-blue-400 mb-2">Tutoriais iOS</h4>{tutorialsList?.filter((t: any) => t.type === "panel_ios").map((t: any) => <div key={t.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm"><span>{t.title}</span><Button size="sm" variant="destructive" onClick={() => deleteTutorialMutation.mutate({ tutorialId: t.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div></CardContent></Card>
        </TabsContent>

        {/* PROXY IOS IPA */}
        <TabsContent value="iosIpaPanel" className="space-y-4">
          <Card className="bg-violet-950/30 border-violet-800 text-white"><CardHeader><CardTitle className="text-white">Administração do Proxy iOS IPA</CardTitle></CardHeader><CardContent><p className="text-sm text-violet-100">Créditos e Keys independentes do Proxy iOS comum. Novos clientes recebem a última Key IPA ativa.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Créditos Proxy iOS IPA por revendedor</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Créditos IPA</TableHead><TableHead className="text-white font-bold text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{resellers?.map((r: any) => <TableRow key={r.id} className="border-neutral-800"><TableCell className="font-bold text-white">{r.username}</TableCell><TableCell className="text-violet-400 font-black">{r.credits?.ios_ipa || 0}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="border-violet-700 bg-violet-950/40 text-violet-300" onClick={() => { const action = prompt(`Para ${r.username}, digite add ou remove:`); if (action === "add" || action === "remove") { const amount = Number(prompt("Quantidade de créditos IPA:")); if (Number.isInteger(amount) && amount > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "ios_ipa", action, amount }); } }}>Adicionar/Remover</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Keys Proxy iOS IPA</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Cole a Key IPA" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} /><Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: "ios_ipa" })}>Adicionar Key IPA</Button><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Uma Key IPA por linha" value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} /><Button className="w-full bg-violet-800 hover:bg-violet-900 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: "ios_ipa" })}>Importar Keys IPA</Button></CardContent></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Download Proxy iOS IPA</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Descrição" value={dlDesc} onChange={(e) => setDlDesc(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={dlVersion} onChange={(e) => setDlVersion(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do arquivo" value={dlUrl} onChange={(e) => setDlUrl(e.target.value)} /><Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: "ios_ipa" })}>Cadastrar Download IPA</Button></CardContent></Card>
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Tutorial Proxy iOS IPA</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Descrição" value={tutDesc} onChange={(e) => setTutDesc(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do vídeo ou MediaFire" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} /><Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: "ios_ipa" })}>Cadastrar Tutorial IPA</Button></CardContent></Card>
          </div>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Conteúdo Proxy iOS IPA cadastrado</CardTitle></CardHeader><CardContent className="space-y-4"><div><h4 className="text-sm font-bold text-violet-400 mb-2">Downloads</h4>{downloadsList?.filter((d: any) => d.type === "ios_ipa").map((d: any) => <div key={d.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm"><span>{d.title} — v{d.version}</span><Button size="sm" variant="destructive" onClick={() => deleteDownloadMutation.mutate({ downloadId: d.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div><div><h4 className="text-sm font-bold text-violet-400 mb-2">Tutoriais</h4>{tutorialsList?.filter((t: any) => t.type === "ios_ipa").map((t: any) => <div key={t.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm"><span>{t.title}</span><Button size="sm" variant="destructive" onClick={() => deleteTutorialMutation.mutate({ tutorialId: t.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div></CardContent></Card>
        </TabsContent>
        <TabsContent value="iosIpaKeys" className="space-y-4"><Card className="bg-violet-950/30 border-violet-800 text-white"><CardHeader><CardTitle className="text-white">Keys Proxy iOS IPA</CardTitle></CardHeader><CardContent><p className="text-sm text-violet-100">Disponíveis: <strong>{keysList?.filter(k => k.type === "ios_ipa" && !k.isUsed && !k.isBanned).length || 0}</strong> · Usadas: <strong>{keysList?.filter(k => k.type === "ios_ipa" && (k.isUsed || k.isBanned)).length || 0}</strong></p><div className="mt-3 max-h-80 overflow-y-auto space-y-1">{keysList?.filter(k => k.type === "ios_ipa").map(k => <div key={k.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-xs"><span className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</span><Badge className={k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-emerald-950 text-emerald-400 border-emerald-800"}>{k.isUsed ? "Usada" : "Disponível"}</Badge></div>)}</div></CardContent></Card></TabsContent>

        {/* PAINEL ANDROID */}
        <TabsContent value="androidPanel" className="space-y-4">
          <Card className="bg-orange-950/30 border-orange-800 text-white"><CardHeader><CardTitle className="text-white">Administração completa do Painel Android</CardTitle></CardHeader><CardContent><p className="text-sm text-orange-100">Este painel usa o tipo <strong>panel_android</strong>, com créditos, Keys e conteúdos separados.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Créditos do Painel Android por revendedor</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Créditos Painel Android</TableHead><TableHead className="text-white font-bold text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{resellers?.map((r: any) => <TableRow key={r.id} className="border-neutral-800"><TableCell className="font-bold text-white">{r.username}</TableCell><TableCell className="text-orange-400 font-black">{r.credits?.panel_android || 0}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="border-orange-700 bg-orange-950/40 text-orange-300" onClick={() => { const action = prompt(`Para ${r.username}, digite add ou remove:`); if (action === "add" || action === "remove") { const amount = Number(prompt("Quantidade de créditos Painel Android:")); if (Number.isInteger(amount) && amount > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "panel_android", action, amount }); } }}>Adicionar/Remover créditos</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Keys do Painel Android</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Cole a Key do Painel Android" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} /><Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: "panel_android" })}>Adicionar Key Painel Android</Button><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Uma Key por linha" value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} /><Button className="w-full bg-orange-800 hover:bg-orange-900 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: "panel_android" })}>Importar Keys Painel Android</Button></CardContent></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Download Painel Android</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={dlVersion} onChange={(e) => setDlVersion(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="URL do download" value={dlUrl} onChange={(e) => setDlUrl(e.target.value)} /><Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: "panel_android" })}>Cadastrar Download</Button></CardContent></Card><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Tutorial Painel Android</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do tutorial" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} /><Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: "panel_android" })}>Cadastrar Tutorial</Button></CardContent></Card></div>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Conteúdo Painel Android cadastrado</CardTitle></CardHeader><CardContent><p className="text-sm text-neutral-300">Downloads: {downloadsList?.filter((d: any) => d.type === "panel_android").length || 0} · Tutoriais: {tutorialsList?.filter((t: any) => t.type === "panel_android").length || 0}</p></CardContent></Card>
        </TabsContent>

        {/* KEYS PAINEL ANDROID */}
        <TabsContent value="androidKeys" className="space-y-4">
          <Card className="bg-orange-950/30 border-orange-800 text-white"><CardHeader><CardTitle className="text-white">Keys do Painel Android</CardTitle></CardHeader><CardContent><p className="text-sm text-orange-100">Disponíveis: <strong>{keysList?.filter(k => k.type === "panel_android" && !k.isUsed && !k.isBanned).length || 0}</strong> · Usadas: <strong>{keysList?.filter(k => k.type === "panel_android" && (k.isUsed || k.isBanned)).length || 0}</strong></p><div className="mt-3 max-h-80 overflow-y-auto space-y-1">{keysList?.filter(k => k.type === "panel_android").map(k => <div key={k.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-xs"><span className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</span><Badge className={k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-emerald-950 text-emerald-400 border-emerald-800"}>{k.isUsed ? "Usada" : "Disponível"}</Badge></div>)}</div></CardContent></Card>
        </TabsContent>

        {/* PAINEL LEGÍTIMO */}
        <TabsContent value="legitPanel" className="space-y-4">
          <Card className="bg-cyan-950/30 border-cyan-800 text-white"><CardHeader><CardTitle className="text-white">Administração completa do Painel Legítimo</CardTitle></CardHeader><CardContent><p className="text-sm text-cyan-100">Este painel usa o tipo <strong>panel_legitimo</strong>, com créditos, Keys e conteúdos totalmente separados.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Créditos do Painel Legítimo por revendedor</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Créditos</TableHead><TableHead className="text-white font-bold text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{resellers?.map((r: any) => <TableRow key={r.id} className="border-neutral-800"><TableCell className="font-bold text-white">{r.username}</TableCell><TableCell className="text-cyan-400 font-black">{r.credits?.panel_legitimo || 0}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="border-cyan-700 bg-cyan-950/40 text-cyan-300" onClick={() => { const action = prompt(`Para ${r.username}, digite add ou remove:`); if (action === "add" || action === "remove") { const amount = Number(prompt("Quantidade de créditos Painel Legítimo:")); if (Number.isInteger(amount) && amount > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "panel_legitimo", action, amount }); } }}>Adicionar/Remover créditos</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Key Painel Legítimo</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Cole a Key do Painel Legítimo" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} /><Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: "panel_legitimo" })}>Adicionar Key</Button><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Uma Key por linha" value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} /><Button className="w-full bg-cyan-800 hover:bg-cyan-900 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\\n"), type: "panel_legitimo" })}>Importar Keys</Button></CardContent></Card>
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Keys Painel Legítimo</CardTitle></CardHeader><CardContent><p className="text-emerald-400 font-bold">Disponíveis: {keysList?.filter(k => k.type === "panel_legitimo" && !k.isUsed && !k.isBanned).length || 0}</p><p className="text-amber-400 font-bold">Já usadas: {keysList?.filter(k => k.type === "panel_legitimo" && (k.isUsed || k.isBanned)).length || 0}</p><div className="mt-3 max-h-64 overflow-y-auto space-y-1">{keysList?.filter(k => k.type === "panel_legitimo").map(k => <div key={k.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-xs"><span className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</span><Badge className={k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-emerald-950 text-emerald-400 border-emerald-800"}>{k.isUsed ? "Usada" : "Disponível"}</Badge></div>)}</div></CardContent></Card>
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Download Painel Legítimo</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={dlVersion} onChange={(e) => setDlVersion(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="URL" value={dlUrl} onChange={(e) => setDlUrl(e.target.value)} /><Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: "panel_legitimo" })}>Cadastrar Download</Button></CardContent></Card>
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Tutorial Painel Legítimo</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do tutorial" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} /><Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: "panel_legitimo" })}>Cadastrar Tutorial</Button></CardContent></Card>
          </div>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Conteúdo Painel Legítimo cadastrado</CardTitle></CardHeader><CardContent className="space-y-3"><div><h4 className="text-sm font-bold text-cyan-400">Downloads</h4>{downloadsList?.filter((d: any) => d.type === "panel_legitimo").map((d: any) => <div key={d.id} className="flex justify-between border-b border-neutral-800 py-2 text-sm"><span>{d.title} — v{d.version}</span><Button size="sm" variant="destructive" onClick={() => deleteDownloadMutation.mutate({ downloadId: d.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div><div><h4 className="text-sm font-bold text-cyan-400">Tutoriais</h4>{tutorialsList?.filter((t: any) => t.type === "panel_legitimo").map((t: any) => <div key={t.id} className="flex justify-between border-b border-neutral-800 py-2 text-sm"><span>{t.title}</span><Button size="sm" variant="destructive" onClick={() => deleteTutorialMutation.mutate({ tutorialId: t.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div></CardContent></Card>
        </TabsContent>

        <TabsContent value="legitKeys" className="space-y-4">
          <Card className="bg-cyan-950/30 border-cyan-800 text-white"><CardHeader><CardTitle className="text-white">Keys do Painel Legítimo</CardTitle></CardHeader><CardContent><p className="text-sm text-cyan-100">As Keys abaixo pertencem somente ao tipo <strong>panel_legitimo</strong>.</p><div className="grid grid-cols-2 gap-3 mt-3"><div className="rounded border border-emerald-800 bg-emerald-950/30 p-3"><p className="text-xs text-emerald-300">Disponíveis</p><p className="text-2xl font-black text-emerald-400">{keysList?.filter(k => k.type === "panel_legitimo" && !k.isUsed && !k.isBanned).length || 0}</p></div><div className="rounded border border-amber-800 bg-amber-950/30 p-3"><p className="text-xs text-amber-300">Já usadas</p><p className="text-2xl font-black text-amber-400">{keysList?.filter(k => k.type === "panel_legitimo" && (k.isUsed || k.isBanned)).length || 0}</p></div></div></CardContent></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-emerald-400">Keys disponíveis</CardTitle></CardHeader><CardContent><div className="max-h-80 overflow-y-auto space-y-2">{keysList?.filter(k => k.type === "panel_legitimo" && !k.isUsed && !k.isBanned).map(k => <div key={k.id} className="flex items-center justify-between border-b border-neutral-800 py-2"><span className="font-mono text-xs text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</span><Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div></CardContent></Card><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-amber-400">Keys já usadas</CardTitle></CardHeader><CardContent><div className="max-h-80 overflow-y-auto space-y-2">{keysList?.filter(k => k.type === "panel_legitimo" && (k.isUsed || k.isBanned)).map(k => <div key={k.id} className="flex items-center justify-between border-b border-neutral-800 py-2"><span className="font-mono text-xs text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</span><span className="text-[10px] text-neutral-500">{k.usedAt ? new Date(k.usedAt).toLocaleString() : "Usada"}</span></div>)}</div></CardContent></Card></div>
        </TabsContent>

        {/* GERENCIAR KEYS */}
        <TabsContent value="keys" className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-2 bg-[#141414] border border-neutral-800 p-4 rounded-lg">
            <div>
              <h3 className="text-sm font-bold text-white">Segurança e Gestão de Chaves</h3>
              <p className="text-xs text-neutral-400">As chaves aparecem mascaradas por padrão. Você também pode remover todas as chaves expiradas (&gt;24h de uso).</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={() => {
                if (confirm("Deseja realmente excluir todas as chaves expiradas (mais de 24h de uso)?")) {
                  deleteExpiredKeysMutation.mutate();
                }
              }}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir Keys Expiradas
              </Button>
              <Button className={keysRevealed ? "bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer" : "bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"} onClick={() => setKeysRevealed(prev => !prev)}>
                {keysRevealed ? "🔓 Ocultar Keys" : "🔒 Revelar Keys"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader><CardTitle className="text-white">Adicionar Key Individual</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Tipo de Proxy</label>
                  <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={newKeyType} onChange={(e: any) => setNewKeyType(e.target.value)}>
                    <option value="basic">Android Basic</option>
                    <option value="advanced">Android Advanced</option>
                    <option value="ios">Proxy iOS</option>
                    <option value="panel_ios">Painel iOS</option>
                    <option value="panel_legitimo">Painel Legítimo</option>
                <option value="panel_android">Painel Android</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
                  </select>
                </div>
                <Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Ex: SHELBY-XXXX-YYYY" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} />
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => {
                  if (!newKeyVal.trim()) { toast.error("Digite uma Key antes de adicionar."); return; }
                  addKeyMutation.mutate({ keyValue: newKeyVal.trim(), type: newKeyType });
                }}>
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
                    <option value="basic">Android Basic</option>
                    <option value="advanced">Android Advanced</option>
                    <option value="ios">Proxy iOS</option>
                    <option value="panel_ios">Painel iOS</option>
                    <option value="panel_legitimo">Painel Legítimo</option>
                <option value="panel_android">Painel Android</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
                  </select>
                </div>
                <textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Cole uma key por linha..." value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} />
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => {
                  if (!batchKeysText.trim()) { toast.error("Cole pelo menos uma Key antes de importar."); return; }
                  batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: batchKeyType });
                }}>
                  Importar em Lote
                </Button>
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold mt-2" onClick={() => {
                  if (confirm("Tem certeza que deseja remover todas as keys que começam com 'hg' ou 'HG'?")) {
                    deleteHgKeysMutation.mutate();
                  }
                }}>
                  Remover Todas as Keys com Início "HG"
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Keys - Proxy Basic</CardTitle>
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
                    {keysList?.filter(k => k.type === "basic" && !k.isBanned && !k.isUsed).map((k) => (
                      <TableRow key={k.id} className="border-neutral-800">
                        <TableCell className="font-mono text-white">#{k.id}</TableCell>
                        <TableCell className="font-mono text-red-500 font-bold">{keysRevealed ? k.keyValue : "••••••••••••••••"}</TableCell>
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
                <CardTitle className="text-white">Keys - Proxy Advanced</CardTitle>
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
                    {keysList?.filter(k => k.type === "advanced" && !k.isBanned && !k.isUsed).map((k) => (
                      <TableRow key={k.id} className="border-neutral-800">
                        <TableCell className="font-mono text-white">#{k.id}</TableCell>
                        <TableCell className="font-mono text-amber-400 font-bold">{keysRevealed ? k.keyValue : "••••••••••••••••"}</TableCell>
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

            {/* Controle de Rotação Automática / Manual iOS */}
            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Gerenciamento & Rotação Automática (8h) - Proxy iOS</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                    const active = (window as any)._iosRotationActive !== false;
                    (window as any)._iosRotationActive = !active;
                    toast.success(!active ? "Rotação automática de chaves iOS (8h) ATIVADA." : "Rotação automática de chaves iOS PAUSADA.");
                  }}>
                    {(window as any)._iosRotationActive !== false ? "Pausar Rotação 8h" : "Retomar Rotação 8h"}
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
                    forceRotateIosMutation.mutate();
                  }}>
                    Forçar Rotação Manual
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-neutral-400">
                  <p>• Revendedores Premium possuem rotação automática a cada 8 horas e mantêm no mínimo 3 chaves ativas.</p>
                  <p>• Quando o estoque de chaves iOS livres ficar abaixo de 3, o sistema emitirá um alerta automático nos logs.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Keys - Proxy iOS</CardTitle>
                <Button size="sm" className="bg-neutral-800 hover:bg-neutral-700 text-white" onClick={() => {
                  if (!keysList) return;
                  const text = keysList.filter(k => k.type === "ios").map((k) => k.keyValue).join("\n");
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "keys_ios.txt";
                  a.click();
                }}>
                  Exportar iOS (.txt)
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
                    {keysList?.filter(k => k.type === "ios").map((k) => (
                      <TableRow key={k.id} className="border-neutral-800">
                        <TableCell className="font-mono text-white">#{k.id}</TableCell>
                        <TableCell className="font-mono text-blue-400 font-bold">{keysRevealed ? k.keyValue : "••••••••••••••••"}</TableCell>
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
          <Card className="bg-[#141414] border-blue-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-white">Keys - Painel iOS</CardTitle><p className="text-xs text-neutral-400 mt-1">Controle separado das Keys disponíveis e já usadas pelo Painel iOS.</p></div>
              <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-white" onClick={() => {
                const available = (keysList || []).filter(k => k.type === "panel_ios" && !k.isUsed && !k.isBanned).map(k => k.keyValue).join("\\n");
                const used = (keysList || []).filter(k => k.type === "panel_ios" && (k.isUsed || k.isBanned)).map(k => k.keyValue).join("\\n");
                const text = `PAINEL IOS - DISPONIVEIS\\n${available}\\n\\nPAINEL IOS - USADAS\\n${used}`;
                const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "keys_painel_ios.txt"; a.click(); URL.revokeObjectURL(url);
              }}>Exportar Painel iOS</Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Card className="bg-emerald-950/30 border-emerald-800"><CardContent className="p-4"><p className="text-xs text-emerald-300 uppercase font-bold">Disponíveis</p><p className="text-2xl text-emerald-400 font-black">{keysList?.filter(k => k.type === "panel_ios" && !k.isUsed && !k.isBanned).length || 0}</p></CardContent></Card><Card className="bg-amber-950/30 border-amber-800"><CardContent className="p-4"><p className="text-xs text-amber-300 uppercase font-bold">Já usadas</p><p className="text-2xl text-amber-400 font-black">{keysList?.filter(k => k.type === "panel_ios" && (k.isUsed || k.isBanned)).length || 0}</p></CardContent></Card></div>
              <div><h4 className="text-sm text-emerald-400 font-bold mb-2">Keys disponíveis</h4><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white">ID</TableHead><TableHead className="text-white">Key</TableHead><TableHead className="text-white">Estado</TableHead><TableHead className="text-white text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{keysList?.filter(k => k.type === "panel_ios" && !k.isUsed && !k.isBanned).map(k => <TableRow key={k.id} className="border-neutral-800"><TableCell>#{k.id}</TableCell><TableCell className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</TableCell><TableCell><Badge className="bg-emerald-950 text-emerald-400 border-emerald-800">Disponível</Badge></TableCell><TableCell className="text-right space-x-1"><Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white" onClick={() => toggleKeyMutation.mutate({ keyId: k.id })}><Power className="w-3 h-3" /></Button><Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}><Trash2 className="w-3 h-3" /></Button></TableCell></TableRow>)}</TableBody></Table></div></div>
              <div><h4 className="text-sm text-amber-400 font-bold mb-2">Keys já usadas</h4><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white">ID</TableHead><TableHead className="text-white">Key</TableHead><TableHead className="text-white">Estado</TableHead><TableHead className="text-white">Usada em</TableHead><TableHead className="text-white text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{keysList?.filter(k => k.type === "panel_ios" && (k.isUsed || k.isBanned)).map(k => <TableRow key={k.id} className="border-neutral-800"><TableCell>#{k.id}</TableCell><TableCell className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</TableCell><TableCell><Badge className="bg-amber-950 text-amber-400 border-amber-800">Usada</Badge></TableCell><TableCell className="text-xs text-neutral-400">{k.usedAt ? new Date(k.usedAt).toLocaleString() : "—"}</TableCell><TableCell className="text-right"><Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}><Trash2 className="w-3 h-3" /></Button></TableCell></TableRow>)}</TableBody></Table></div></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KEYS BANIDAS / USADAS */}
        <TabsContent value="bannedKeys" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader>
              <CardTitle className="text-white">Histórico de Keys Banidas / Usadas do Estoque</CardTitle>
              <p className="text-xs text-neutral-400">Estas chaves foram retiradas permanentemente do estoque ativo de Basic e Advanced após serem usadas por clientes, mas continuam ativas para os respectivos usuários.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead className="text-white font-bold">ID</TableHead>
                    <TableHead className="text-white font-bold">Chave</TableHead>
                    <TableHead className="text-white font-bold">Tipo</TableHead>
                    <TableHead className="text-white font-bold">Data/Hora de Uso</TableHead>
                    <TableHead className="text-white font-bold text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysList?.filter(k => k.isBanned || (k.isUsed && k.type !== 'ios')).map((k) => (
                    <TableRow key={k.id} className="border-neutral-800">
                      <TableCell className="font-mono text-white">#{k.id}</TableCell>
                      <TableCell className="font-mono text-amber-400 font-bold">
                        {keysRevealed ? k.keyValue : "••••••••••••••••"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-red-950 text-red-400 border-red-800 uppercase text-[10px]">
                          {k.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-neutral-300 text-xs">
                        {k.usedAt ? new Date(k.usedAt).toLocaleString() : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-amber-950 text-amber-400 border-amber-800">
                          Banida do Estoque (Em Uso)
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!keysList || keysList.filter(k => k.isBanned || (k.isUsed && k.type !== 'ios')).length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-neutral-500 py-6">
                        Nenhuma chave banida/usada no momento.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOWNLOADS */}
        <TabsContent value="downloads" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">{editingDownload ? "Editar Download" : "Cadastrar Novo Download"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-white font-semibold block mb-1">Tipo de Download</label>
                <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={editingDownload ? editingDownload.type : dlType} onChange={(e: any) => editingDownload ? setEditingDownload({...editingDownload, type: e.target.value}) : setDlType(e.target.value)}>
                  <option value="basic">Proxy Basic</option>
                  <option value="advanced">Proxy Advanced</option>
                  <option value="ios">Proxy iOS</option>
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
                      <TableCell><Badge className={d.type === "advanced" ? "bg-amber-950 text-amber-400 border-amber-800" : d.type === "ios" ? "bg-blue-950 text-blue-400 border-blue-800" : "bg-neutral-800 text-white"}>{d.type === "advanced" ? "Advanced" : d.type === "ios" ? "iOS" : "Basic"}</Badge></TableCell>
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
                  <option value="basic">Android Basic</option>
                  <option value="advanced">Android Advanced</option>
                  <option value="ios">Proxy iOS</option>
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
                      <TableCell><Badge className={t.type === "advanced" ? "bg-amber-950 text-amber-400 border-amber-800" : t.type === "ios" ? "bg-blue-950 text-blue-400 border-blue-800" : "bg-neutral-800 text-white"}>{t.type === "advanced" ? "Advanced" : t.type === "ios" ? "iOS" : "Basic"}</Badge></TableCell>
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



        <TabsContent value="keyAudit" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-white">Keys geradas por revendedor</CardTitle>
                  <p className="text-xs text-neutral-400">Filtre por tipo para ver quantas Keys foram atribuídas e quais clientes receberam cada uma.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input value={keyAuditSearch} onChange={(e) => setKeyAuditSearch(e.target.value)} placeholder="Pesquisar Key ou cliente" className="bg-[#222] border-neutral-700 text-white text-xs w-48" />
                  <input type="date" value={keyAuditFrom} onChange={(e) => setKeyAuditFrom(e.target.value)} className="bg-[#222] border border-neutral-700 rounded px-2 py-2 text-xs text-white" title="Data inicial" />
                  <input type="date" value={keyAuditTo} onChange={(e) => setKeyAuditTo(e.target.value)} className="bg-[#222] border border-neutral-700 rounded px-2 py-2 text-xs text-white" title="Data final" />
                  <select value={keyAuditType} onChange={(e) => setKeyAuditType(e.target.value as any)} className="bg-[#222] border border-neutral-700 rounded px-3 py-2 text-xs text-white">
                    <option value="all">Todos os tipos</option>
                    <option value="ios">Proxy iOS</option>
                    <option value="advanced">Proxy Advanced</option>
                    <option value="basic">Proxy Basic</option>
                    <option value="panel_ios">Painel iOS</option>
                    <option value="panel_legitimo">Painel Legítimo</option>
                <option value="panel_android">Painel Android</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {[
                  { type: "all", label: "Total" },
                  { type: "ios", label: "Proxy iOS" },
                  { type: "advanced", label: "Proxy Advanced" },
                  { type: "basic", label: "Proxy Basic" },
                  { type: "panel_ios", label: "Painel iOS" },
                  { type: "panel_legitimo", label: "Legítimo" },
                  { type: "panel_android", label: "Painel Android" },
                  { type: "ios_ipa", label: "Proxy iOS IPA" },
                ].map((item) => <div key={item.type} className="rounded border border-neutral-800 bg-[#1b1b1b] p-2"><p className="text-[10px] text-neutral-400">{item.label}</p><p className="text-xl font-black text-amber-400">{resellerKeyAudit?.reduce((sum: number, audit: any) => sum + (item.type === "all" ? audit.totalKeys : Number(audit.counts?.[item.type] || 0)), 0) || 0}</p></div>)}
              </div>
              {resellerKeyAudit?.map((audit: any) => {
                const search = keyAuditSearch.trim().toLowerCase();
                const fromTime = keyAuditFrom ? new Date(`${keyAuditFrom}T00:00:00`).getTime() : null;
                const toTime = keyAuditTo ? new Date(`${keyAuditTo}T23:59:59`).getTime() : null;
                const filteredKeys = audit.keys.filter((item: any) => {
                  const dateValue = item.deletedAt || item.keyUsedAt || item.clientCreatedAt;
                  const dateTime = dateValue ? new Date(dateValue).getTime() : null;
                  return (keyAuditType === "all" || item.keyType === keyAuditType) && (!search || `${item.keyValue} ${item.clientUsername}`.toLowerCase().includes(search)) && (fromTime === null || (dateTime !== null && dateTime >= fromTime)) && (toTime === null || (dateTime !== null && dateTime <= toTime));
                });
                if (keyAuditType !== "all" && filteredKeys.length === 0) return null;
                return (
                <Card key={audit.resellerId} className="bg-[#1b1b1b] border-neutral-700 text-white">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base text-white">{audit.resellerUsername} <span className={audit.resellerIsPremium ? "text-amber-400 text-xs" : "text-emerald-400 text-xs"}>({audit.resellerIsPremium ? "Premium" : "Basic"})</span></CardTitle>
                      <Badge className="bg-amber-950/50 text-amber-300 border-amber-800">{audit.totalKeys} Key(s)</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-neutral-300">
                      {Object.entries(audit.counts || {}).map(([type, count]) => <span key={type} className="rounded border border-neutral-700 px-2 py-1">{type}: {String(count)}</span>)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredKeys.length === 0 ? <p className="text-sm text-neutral-400">Nenhuma Key deste tipo atribuída a este revendedor.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-700"><TableHead className="text-white">Key</TableHead><TableHead className="text-white">Tipo</TableHead><TableHead className="text-white">Cliente</TableHead><TableHead className="text-white">Status</TableHead><TableHead className="text-white">Usada em</TableHead></TableRow></TableHeader><TableBody>{filteredKeys.map((item: any) => <TableRow key={`${audit.resellerId}-${item.clientId}-${item.keyId}`} className="border-neutral-700"><TableCell className="font-mono text-xs text-cyan-300">{item.keyValue}</TableCell><TableCell className="text-xs text-white">{item.keyType}</TableCell><TableCell className="text-xs text-white">{item.clientUsername}</TableCell><TableCell className="text-xs"><span className={item.isDeleted ? "text-red-400" : item.keyIsBanned ? "text-red-400" : item.keyIsUsed ? "text-amber-400" : "text-emerald-400"}>{item.isDeleted ? "Login excluído" : item.keyIsBanned ? "Banida" : item.keyIsUsed ? "Usada" : "Disponível"}</span></TableCell><TableCell className="text-xs text-neutral-400">{(item.deletedAt || item.keyUsedAt || item.clientCreatedAt) ? new Date(item.deletedAt || item.keyUsedAt || item.clientCreatedAt).toLocaleString() : "-"}</TableCell></TableRow>)}</TableBody></Table></div>}
                  </CardContent>
                </Card>
                              )
              })}
            </CardContent>
          </Card>
        </TabsContent>
        {/* LOGS */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader><CardTitle className="text-white">Logs separados dos revendedores</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Data</TableHead><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Plano</TableHead><TableHead className="text-white font-bold">Ação</TableHead><TableHead className="text-white font-bold">Detalhes</TableHead></TableRow></TableHeader><TableBody>
                {resellerLogsList?.map((log: any) => <TableRow key={log.id} className="border-neutral-800"><TableCell className="text-xs text-neutral-400">{new Date(log.createdAt).toLocaleString()}</TableCell><TableCell className="font-bold text-white">{log.resellerUsername}</TableCell><TableCell className={log.resellerIsPremium ? "text-amber-400" : "text-emerald-400"}>{log.resellerIsPremium ? "Premium" : "Basic"}</TableCell><TableCell className="text-blue-300 font-mono text-xs">{log.action}</TableCell><TableCell className="text-xs text-neutral-300 max-w-xl">{log.details}</TableCell></TableRow>)}
              </TableBody></Table></div>
            </CardContent>
          </Card>
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
  const { data: subResellers, refetch: refetchSubResellers } = trpc.moderator.listResellers.useQuery(undefined, {
    enabled: !!data?.isPremium
  });

  const [newClientUser, setNewClientUser] = useState("");
  const [newClientPass, setNewClientPass] = useState("");
  const [newClientType, setNewClientType] = useState<any>("basic");
  const [newClientMaxDevices, setNewClientMaxDevices] = useState(1);
  const [clientSearch, setClientSearch] = useState("");
  const [renewingClient, setRenewingClient] = useState<{ id: number; username: string } | null>(null);
  const [renewType, setRenewType] = useState<any>("advanced");
  const [iosClientSearch, setIosClientSearch] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const allResellerProducts = ["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"];
  const enabledResellerProducts = data?.enabledProducts || allResellerProducts;
  const canUseProduct = (type: string) => enabledResellerProducts.includes(type);

  // Estados para criação de sub-revendedor (Premium Reseller)
  const [newSubUser, setNewSubUser] = useState("");
  const [newSubPass, setNewSubPass] = useState("");
  const [newSubCreditsBasic, setNewSubCreditsBasic] = useState(0);
  const [newSubCreditsAdvanced, setNewSubCreditsAdvanced] = useState(0);
  const [newSubCreditsIos, setNewSubCreditsIos] = useState(0);

  const createResellerMutation = trpc.moderator.createReseller.useMutation({
    onSuccess: () => {
      toast.success("Sub-revendedor criado com sucesso!");
      setNewSubUser("");
      setNewSubPass("");
      setNewSubCreditsBasic(0);
      setNewSubCreditsAdvanced(0);
      setNewSubCreditsIos(0);
      refetchSubResellers();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCreditsMutation = trpc.moderator.updateResellerCredits.useMutation({
    onSuccess: () => {
      toast.success("Créditos atualizados!");
      refetchSubResellers();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const createClientMutation = trpc.reseller.createClient.useMutation({
    onSuccess: (res) => {
      toast.success("Cliente criado com sucesso! 1 crédito consumido.");
      setCreatedCredentials({ username: res.createdUsername, password: res.createdPassword });
      setNewClientUser("");
      setNewClientPass("");
      setNewClientMaxDevices(1);
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

  const resetClientSessionMutation = trpc.reseller.resetClientSession.useMutation({
    onSuccess: () => toast.success("Sessão do cliente resetada! Ele poderá entrar novamente em outro navegador/dispositivo."),
    onError: (e: any) => toast.error(e.message),
  });

  const resetResellerSessionMutation = trpc.moderator.resetUserSession.useMutation({
    onSuccess: () => toast.success("Sessão do revendedor Basic resetada!"),
    onError: (e: any) => toast.error(e.message),
  });

  const renewClientMutation = trpc.reseller.renewClient.useMutation({
    onSuccess: (res) => {
      toast.success(`Cliente renovado com sucesso! Nova Key atribuída: ${res.newKeyValue}`);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addHoursMutation = trpc.reseller.addHours.useMutation({
    onSuccess: () => {
      toast.success("Horas adicionadas sem renovar a key!");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'basic', label: 'Android Basic', color: 'text-red-600' },
          { name: 'advanced', label: 'Android Advanced', color: 'text-amber-400' },
          { name: 'ios', label: 'Proxy iOS', color: 'text-blue-400' },
          { name: 'panel_ios', label: 'Painel iOS', color: 'text-cyan-400' },
          { name: 'panel_legitimo', label: 'Painel Legítimo', color: 'text-emerald-400' },
          { name: 'panel_android', label: 'Painel Android', color: 'text-orange-400' },
          { name: 'ios_ipa', label: 'Proxy iOS IPA', color: 'text-violet-400' }
        ].filter((cat) => canUseProduct(cat.name)).map((cat) => (
          <Card key={cat.name} className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-white">Créditos {cat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-black ${cat.color}`}>
                {(data?.credits as any)?.[cat.name] || 0}
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="bg-[#141414] border-neutral-800 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-white">Total Clientes Criados</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-bold text-white">{data?.clientsCount || 0}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
                  <TabsList className="bg-[#141414] border border-neutral-800 p-1">
          <TabsTrigger value="clients" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Seus Clientes</TabsTrigger>
          {canUseProduct("ios") && <TabsTrigger value="ios" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white">Painel iOS</TabsTrigger>}
          {canUseProduct("panel_legitimo") && <TabsTrigger value="legitimo" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-white">Painel Legítimo</TabsTrigger>}
          {canUseProduct("panel_android") && <TabsTrigger value="androidPanel" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white">Painel Android</TabsTrigger>}
          {canUseProduct("ios_ipa") && <TabsTrigger value="iosIpaPanel" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white">Proxy iOS IPA</TabsTrigger>}
          {data?.isPremium && (
            <TabsTrigger value="subresellers" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Seus Revendedores</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="clients" className="space-y-4">

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
                <option value="basic">Android Basic</option>
                <option value="advanced">Android Advanced</option>
                <option value="ios">Proxy iOS</option>
                <option value="panel_ios">Painel iOS</option>
                <option value="panel_legitimo">Painel Legítimo</option>
                <option value="panel_android">Painel Android</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
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
            <div>
              <label className="text-xs text-white font-semibold block mb-1">Limite Dispositivos</label>
              <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={newClientMaxDevices} onChange={(e: any) => setNewClientMaxDevices(Number(e.target.value))}>
                <option value={1}>1 Dispositivo</option>
                <option value={2}>2 Dispositivos</option>
                <option value={3}>3 Dispositivos</option>
                <option value={5}>5 Dispositivos</option>
                <option value={10}>10 Dispositivos</option>
              </select>
            </div>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => createClientMutation.mutate({ username: newClientUser, password: newClientPass, type: newClientType as any, maxDevices: newClientMaxDevices })}>
                <UserPlus className="w-4 h-4 mr-1" /> Gerar Key ({newClientType})
              </Button>
          </div>
        </CardContent>
      </Card>

      {renewingClient && (
        <Card className="bg-neutral-900 border-neutral-700 text-white p-6 space-y-4">
          <CardHeader className="p-0"><CardTitle className="text-white text-base">Renovar Cliente: <span className="text-red-500">{renewingClient.username}</span></CardTitle></CardHeader>
          <CardContent className="p-0 space-y-4">
            <div>
              <label className="text-xs text-white font-semibold block mb-2">Selecione o tipo de proxy para renovação:</label>
              <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={renewType} onChange={(e: any) => setRenewType(e.target.value)}>
                <option value="basic">Android Basic</option>
                <option value="advanced">Android Advanced</option>
                <option value="ios">Proxy iOS</option>
                <option value="panel_ios">Painel iOS</option>
                <option value="panel_legitimo">Painel Legítimo</option>
                <option value="panel_android">Painel Android</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => setRenewingClient(null)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => {
                renewClientMutation.mutate({ clientId: renewingClient.id, type: renewType });
                setRenewingClient(null);
              }}>Confirmar Renovação</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-white">Seus Clientes</CardTitle>
              <div className="w-72">
                <Input
                  className="bg-[#222] border-neutral-700 text-white text-xs placeholder:text-neutral-500"
                  placeholder="Pesquisar login do cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
	                <TableHeader>
	                  <TableRow className="border-neutral-800">
	                    <TableHead className="text-white font-bold">ID</TableHead>
	                    <TableHead className="text-white font-bold">Usuário</TableHead>
	                    <TableHead className="text-white font-bold">Validade / Expiração</TableHead>
	                    <TableHead className="text-white font-bold text-right">Ações</TableHead>
	                  </TableRow>
	                </TableHeader>
	                <TableBody>
	                  {data?.clients?.filter(c => c.username.toLowerCase().includes(clientSearch.toLowerCase())).map((c) => {
	                    const expTime = c.expiresAt ? new Date(c.expiresAt).getTime() : null;
	                    const isExp = expTime ? Date.now() > expTime : false;
		                    return (
		                    <TableRow key={c.id} className="border-neutral-800">
		                      <TableCell className="font-mono text-white">#{c.id}</TableCell>
		                      <TableCell className="font-bold text-white">{c.username}</TableCell>
		                      <TableCell className="text-xs">
		                        {expTime ? (
		                          <span className={isExp ? "text-red-500 font-bold" : "text-emerald-400"}>
		                            {isExp ? "Expirado" : new Date(expTime).toLocaleString()}
		                          </span>
		                        ) : (
		                          <span className="text-neutral-500">Sem uso</span>
		                        )}
		                      </TableCell>
			                      <TableCell className="text-right space-x-1">
                    {(data?.isPremium || c.ownerId === data?.resellerId || (c.ownerRole === "reseller" && !c.ownerIsPremium)) ? <Button size="sm" variant="outline" className="border-emerald-700 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50" onClick={() => setRenewingClient({ id: c.id, username: c.username })}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de outro painel</span>}
                    <Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50" onClick={() => {
                      const hours = Number(prompt(`Quantas horas adicionar ao cliente ${c.username}? A key não será renovada:`));
                      if (Number.isInteger(hours) && hours > 0) addHoursMutation.mutate({ clientId: c.id, hours });
                    }}>+ Horas</Button>
                    <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => {
	                      const p = prompt("Nova senha:");
	                      if (p) resetPassMutation.mutate({ clientId: c.id, newPassword: p });
	                    }}>Senha</Button>
                    <Button size="sm" variant="outline" className="border-amber-700 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50" onClick={() => {
                      if (confirm(`Resetar a sessão de ${c.username}? O cliente poderá entrar novamente em outro navegador/dispositivo.`)) resetClientSessionMutation.mutate({ clientId: c.id });
                    }}>Resetar sessão</Button>
	                    <Button size="sm" variant="destructive" onClick={() => {
	                      if (confirm("Excluir cliente?")) deleteClientMutation.mutate({ clientId: c.id });
	                    }}>
	                      <Trash2 className="w-3 h-3" />
	                    </Button>
	                  </TableCell>
			                </TableRow>
			              );
			            })
			          }
            </TableBody>
		          </Table></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ios" className="space-y-4">
          <Card className="bg-blue-950/30 border-blue-800 text-white">
            <CardHeader><CardTitle className="text-white">Painel iOS / Proxy iOS</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-blue-100">Este painel usa o mesmo fluxo do painel principal. Renovar troca a key; <strong>+ Horas</strong> apenas estende a validade, sem trocar a key e sem consumir crédito.</p></CardContent>
          </Card>
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-white">Clientes Painel iOS</CardTitle><Input className="w-72 bg-[#222] border-neutral-700 text-white text-xs" placeholder="Pesquisar cliente iOS..." value={iosClientSearch} onChange={(e) => setIosClientSearch(e.target.value)} /></CardHeader>
            <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Usuário</TableHead><TableHead className="text-white font-bold">Expiração</TableHead><TableHead className="text-white font-bold text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
              {data?.clients?.filter((c: any) => c.keyType === "panel_ios")?.filter((c: any) => c.username.toLowerCase().includes(iosClientSearch.toLowerCase())).map((c: any) => <TableRow key={c.id} className="border-neutral-800"><TableCell className="font-bold text-white">{c.username}</TableCell><TableCell className="text-emerald-400 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "Sem validade"}</TableCell><TableCell className="text-right space-x-1">{(data?.isPremium || (c.ownerRole === "reseller" && !c.ownerIsPremium)) ? <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setRenewType("panel_ios"); setRenewingClient({ id: c.id, username: c.username }); }}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de Premium</span>}<Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300" onClick={() => { const hours = Number(prompt(`Quantas horas adicionar ao cliente ${c.username}?`)); if (Number.isInteger(hours) && hours > 0) addHoursMutation.mutate({ clientId: c.id, hours }); }}>+ Horas</Button></TableCell></TableRow>)}
            </TableBody></Table></div></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legitimo" className="space-y-4">
          <Card className="bg-cyan-950/30 border-cyan-800 text-white"><CardHeader><CardTitle className="text-white">Painel Legítimo</CardTitle></CardHeader><CardContent><p className="text-sm text-cyan-100">Clientes deste painel usam Keys, créditos e conteúdos exclusivos do tipo <strong>panel_legitimo</strong>.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-white">Clientes Painel Legítimo</CardTitle><Input className="w-72 bg-[#222] border-neutral-700 text-white text-xs" placeholder="Pesquisar cliente..." value={iosClientSearch} onChange={(e) => setIosClientSearch(e.target.value)} /></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Usuário</TableHead><TableHead className="text-white font-bold">Expiração</TableHead><TableHead className="text-white font-bold text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data?.clients?.filter((c: any) => c.keyType === "panel_legitimo")?.filter((c: any) => c.username.toLowerCase().includes(iosClientSearch.toLowerCase())).map((c: any) => <TableRow key={c.id} className="border-neutral-800"><TableCell className="font-bold text-white">{c.username}</TableCell><TableCell className="text-emerald-400 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "Sem validade"}</TableCell><TableCell className="text-right space-x-1">{(data?.isPremium || (c.ownerRole === "reseller" && !c.ownerIsPremium)) ? <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setRenewType("panel_legitimo"); setRenewingClient({ id: c.id, username: c.username }); }}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de Premium</span>}<Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300" onClick={() => { const hours = Number(prompt(`Quantas horas adicionar ao cliente ${c.username}?`)); if (Number.isInteger(hours) && hours > 0) addHoursMutation.mutate({ clientId: c.id, hours }); }}>+ Horas</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="androidPanel" className="space-y-4">
          <Card className="bg-orange-950/30 border-orange-800 text-white"><CardHeader><CardTitle className="text-white">Painel Android</CardTitle></CardHeader><CardContent><p className="text-sm text-orange-100">Clientes deste painel usam Keys, créditos e conteúdos exclusivos do tipo <strong>panel_android</strong>. A renovação troca a Key e consome crédito Painel Android; + Horas apenas estende a validade.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-white">Clientes Painel Android</CardTitle><Input className="w-72 bg-[#222] border-neutral-700 text-white text-xs" placeholder="Pesquisar cliente Android..." value={iosClientSearch} onChange={(e) => setIosClientSearch(e.target.value)} /></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Usuário</TableHead><TableHead className="text-white font-bold">Expiração</TableHead><TableHead className="text-white font-bold text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data?.clients?.filter((c: any) => c.keyType === "panel_android")?.filter((c: any) => c.username.toLowerCase().includes(iosClientSearch.toLowerCase())).map((c: any) => <TableRow key={c.id} className="border-neutral-800"><TableCell className="font-bold text-white">{c.username}</TableCell><TableCell className="text-emerald-400 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "Sem validade"}</TableCell><TableCell className="text-right space-x-1">{data?.isPremium || (c.ownerRole === "reseller" && !c.ownerIsPremium) ? <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setRenewType("panel_android"); setRenewingClient({ id: c.id, username: c.username }); }}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de Premium</span>}<Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300" onClick={() => { const hours = Number(prompt(`Quantas horas adicionar ao cliente ${c.username}?`)); if (Number.isInteger(hours) && hours > 0) addHoursMutation.mutate({ clientId: c.id, hours }); }}>+ Horas</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="iosIpaPanel" className="space-y-4"><Card className="bg-violet-950/30 border-violet-800 text-white"><CardHeader><CardTitle className="text-white">Proxy iOS IPA</CardTitle></CardHeader><CardContent><p className="text-sm text-violet-100">Este painel usa Keys e crédito IPA independentes. Novos clientes recebem a última Key IPA ativa; renovar troca para a Key IPA atual.</p></CardContent></Card><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-white">Clientes Proxy iOS IPA</CardTitle><Input className="w-72 bg-[#222] border-neutral-700 text-white text-xs" placeholder="Pesquisar cliente IPA..." value={iosClientSearch} onChange={(e) => setIosClientSearch(e.target.value)} /></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Usuário</TableHead><TableHead className="text-white font-bold">Expiração</TableHead><TableHead className="text-white font-bold text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data?.clients?.filter((c: any) => c.keyType === "ios_ipa")?.filter((c: any) => c.username.toLowerCase().includes(iosClientSearch.toLowerCase())).map((c: any) => <TableRow key={c.id} className="border-neutral-800"><TableCell className="font-bold text-white">{c.username}</TableCell><TableCell className="text-emerald-400 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "Sem validade"}</TableCell><TableCell className="text-right space-x-1">{data?.isPremium || (c.ownerRole === "reseller" && !c.ownerIsPremium) ? <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setRenewType("ios_ipa"); setRenewingClient({ id: c.id, username: c.username }); }}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de Premium</span>}<Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300" onClick={() => { const hours = Number(prompt(`Quantas horas adicionar ao cliente ${c.username}?`)); if (Number.isInteger(hours) && hours > 0) addHoursMutation.mutate({ clientId: c.id, hours }); }}>+ Horas</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </TabsContent>

        {data?.isPremium && (
          <TabsContent value="subresellers" className="space-y-4">
            <Card className="bg-blue-950/30 border-blue-800 text-white">
              <CardHeader><CardTitle className="text-white">Revendedor Premium — somente distribuição de créditos</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-blue-100">A criação de revendedores é exclusiva do Moderador. Nesta área, você pode apenas adicionar ou remover créditos dos revendedores existentes.</p></CardContent>
            </Card>

            <Card className="bg-[#141414] border-neutral-800 text-white">
              <CardHeader><CardTitle className="text-white">Revendedores sob sua gestão — créditos</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-white font-bold">Usuário</TableHead>
                      <TableHead className="text-white font-bold">Créditos</TableHead>
                      <TableHead className="text-white font-bold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subResellers?.map((r: any) => (
                      <TableRow key={r.id} className="border-neutral-800">
                        <TableCell className="font-bold text-white">{r.username}</TableCell>
                        <TableCell className="space-y-1">
                          {[
                            { name: 'basic', label: 'Android Basic' },
                            { name: 'advanced', label: 'Android Advanced' },
                            { name: 'ios', label: 'Proxy iOS' },
                            { name: 'panel_ios', label: 'Painel iOS' },
                            { name: 'panel_legitimo', label: 'Painel Legítimo' },
                            { name: 'panel_android', label: 'Painel Android' },
                            { name: 'ios_ipa', label: 'Proxy iOS IPA' }
                          ].map((cat) => (
                            <div key={cat.name} className="text-[10px] font-mono text-white flex items-center gap-1">
                              <span className="opacity-70">{cat.label}:</span>
                              <strong className="text-red-500">{(r.credits as any)?.[cat.name] || 0}</strong>
                              <Button size="sm" variant="ghost" className="text-white p-0 h-auto underline text-[10px]" onClick={() => {
                                const action = prompt(`Adicionar ou remover créditos ${cat.label} para ${r.username}? (add ou remove):`);
                                if (action === "add" || action === "remove") {
                                  const val = prompt("Quantidade:");
                                  const num = parseInt(val || "0", 10);
                                  if (!isNaN(num) && num > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: cat.name as any, action, amount: num });
                                }
                              }}>±</Button>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => {
                            const p = prompt("Nova senha:");
                            if (p) resetPassMutation.mutate({ clientId: r.id, newPassword: p });
                          }}>Senha</Button>
                          {!r.isPremium && <Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50" onClick={() => {
                            if (confirm(`Resetar a sessão do revendedor Basic ${r.username}?`)) resetResellerSessionMutation.mutate({ userId: r.id });
                          }}>Resetar sessão</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ClientDashboard() {
  const { data, isLoading } = trpc.clientPanel.dashboard.useQuery();
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showAlert, setShowAlert] = useState(true);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowAlert(false);
    }
  }, [countdown]);

  useEffect(() => {
    const calc = () => {
      if (!data?.expiresAt) return;
      const diff = new Date(data.expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("Expirado");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [data?.expiresAt]);

  const isExpired = data?.expiresAt ? new Date().getTime() > new Date(data.expiresAt).getTime() : false;

  if (isLoading) return <div className="p-8 text-center text-white">Carregando painel...</div>;

  if (isExpired) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-6 bg-[#141414] border border-red-600 rounded-xl text-white text-center space-y-4 shadow-2xl select-none" style={{ WebkitUserSelect: 'none' }}>
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-bounce" />
        <h2 className="text-2xl font-bold text-red-500">Acesso Expirado</h2>
        <p className="text-sm text-neutral-300 font-medium">
          Seu login expirou, contate o suporte da Shelby para renovar.
        </p>
        <div className="pt-2">
          <a
            href="https://discord.gg/YYBZxhhm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg transition"
          >
            Contatar Suporte / Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-white select-none relative" style={{ WebkitUserSelect: 'none' }}>
      {/* Overlay anti-screen sharing / screenshot protection */}
      <div className="absolute inset-0 pointer-events-none z-50 flex items-start justify-end p-2 opacity-10 font-mono text-[10px] text-white overflow-hidden">
        SHELBY SECURE SESSION - NO SCREENSHARE
      </div>
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
              <div className="flex items-center justify-between mb-2">
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
              {data?.keyUsedAt && (
                <div className="text-[11px] text-neutral-400 border-t border-neutral-800 pt-2 mt-2 space-y-1">
                  <div>Ativada em: <span className="text-white">{new Date(data.keyUsedAt).toLocaleString()}</span></div>
                  {data?.expiresAt && (
                    <>
                      <div className="text-amber-400">Expira em: <span className="text-white">{new Date(data.expiresAt).toLocaleString()}</span></div>
                      <div className="text-red-400 font-bold">Tempo restante: {timeLeft}</div>
                    </>
                  )}
                </div>
              )}
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
              data?.downloads?.map((d: any) => (
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
              data?.tutorials?.map((t) => {
                const video = getVideoEmbedUrl(t.videoUrl);
                return <div key={t.id} className="bg-[#1f1f1f] border border-neutral-800 p-4 rounded-lg space-y-3">
                  <div className="space-y-1">
                    <strong className="text-white font-bold text-base">{t.title}</strong>
                    {t.description && <p className="text-xs text-white">{t.description}</p>}
                  </div>
                  {video?.kind === "iframe" && <div className="relative w-full overflow-hidden rounded-lg border border-neutral-700 bg-black aspect-video"><iframe src={video.url} title={t.title} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>}
                  {video?.kind === "video" && <video src={video.url} controls preload="metadata" className="w-full max-h-[520px] rounded-lg border border-neutral-700 bg-black" />}
                  {!video && <p className="text-xs text-amber-300">Este link não pode ser incorporado automaticamente.</p>}
                  <a href={t.videoUrl} target="_blank" rel="noopener noreferrer"><Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"><Video className="w-4 h-4 mr-2" /> Abrir vídeo em nova aba</Button></a>
                </div>;
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
