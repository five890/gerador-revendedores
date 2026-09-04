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
import { Link } from "wouter";
import {
  Lock,
  Unlock,
  RefreshCcw,
  Trash2,
  Power,
  UserPlus,
  Copy,
  Download as DownloadIcon,
  Edit,
  LogOut,
  Shield,
  Users,
  KeyRound,
  FileDown,
  BookOpen,
  AlertTriangle,
  Video,
  History,
  PanelTop,
  ShoppingBag,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const REMOVED_PRODUCT_TYPES = new Set(["basic", "ios", "panel_legitimo"]);
const ACTIVE_PRODUCT_TYPES = ["advanced", "panel_ios", "panel_android", "proxy_android_clientes", "ios_ipa"] as const;
type ActiveProductType = typeof ACTIVE_PRODUCT_TYPES[number];

function getVideoEmbedUrl(rawUrl: string): { kind: "iframe" | "video"; url: string } | null {
  try {
    const parsed = new URL(rawUrl.trim());
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
    if (parsed.protocol === "https:") return { kind: "iframe", url: parsed.toString() };
  } catch {
    return null;
  }
  return null;
}

type ManagementNavItem = {
  value: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
};

type ManagementUser = {
  username: string;
  role: string;
  brandName?: string | null;
  brandColor?: string | null;
};

type ManagementNavigationContextValue = {
  activeSection: string;
  setActiveSection: React.Dispatch<React.SetStateAction<string>>;
  menuItems: ManagementNavItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<ManagementNavItem[]>>;
};

const ManagementNavigationContext = React.createContext<ManagementNavigationContextValue | null>(null);

function useManagementNavigation() {
  const context = React.useContext(ManagementNavigationContext);
  if (!context) throw new Error("useManagementNavigation must be used inside ManagementShell.");
  return context;
}

const moderatorNavigationItems: ManagementNavItem[] = [
  { value: "store", label: "Loja / Produtos", group: "Vendas", icon: ShoppingBag },
  { value: "resellers", label: "Revendedores", group: "Operação", icon: Users },
  { value: "clients", label: "Clientes", group: "Operação", icon: UserPlus },
  { value: "iosPanel", label: "Painel iOS", group: "Painéis", icon: PanelTop },
  { value: "androidPanel", label: "Painel Android", group: "Painéis", icon: Shield },
  { value: "proxyAndroidClientesPanel", label: "Proxy Android Clientes", group: "Painéis", icon: DownloadIcon },
  { value: "iosIpaPanel", label: "Proxy iOS IPA", group: "Painéis", icon: Lock },
  { value: "androidKeys", label: "Keys Android", group: "Keys", icon: KeyRound },
  { value: "proxyAndroidClientesKeys", label: "Keys Proxy Android Clientes", group: "Keys", icon: KeyRound },
  { value: "iosIpaKeys", label: "Keys iOS IPA", group: "Keys", icon: KeyRound },
  { value: "keys", label: "Gerenciar Keys", group: "Keys", icon: KeyRound },
  { value: "bannedKeys", label: "Banidas / Usadas", group: "Keys", icon: Shield },
  { value: "downloads", label: "Downloads", group: "Conteúdo e auditoria", icon: FileDown },
  { value: "tutorials", label: "Tutoriais", group: "Conteúdo e auditoria", icon: BookOpen },
  { value: "logs", label: "Logs", group: "Conteúdo e auditoria", icon: History },
  { value: "keyAudit", label: "Keys por Revendedor", group: "Conteúdo e auditoria", icon: Users },
  { value: "announcements", label: "Avisos", group: "Conteúdo e auditoria", icon: AlertTriangle },
];

const resellerNavigationItems: ManagementNavItem[] = [
  { value: "clients", label: "Seus Clientes", group: "Operação", icon: Users },
  { value: "androidPanel", label: "Painel Android", group: "Painéis", icon: Shield },
  { value: "proxyAndroidClientesPanel", label: "Proxy Android Clientes", group: "Painéis", icon: DownloadIcon },
  { value: "iosIpaPanel", label: "Proxy iOS IPA", group: "Painéis", icon: Lock },
  { value: "subresellers", label: "Seus Revendedores", group: "Operação Premium", icon: UserPlus },
];

function ManagementNavButton({ item }: { item: ManagementNavItem }) {
  const { activeSection, setActiveSection } = useManagementNavigation();
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={activeSection === item.value}
        tooltip={item.label}
        className="h-9 w-full text-left text-xs text-neutral-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-red-600/20 data-[active=true]:font-bold data-[active=true]:text-red-300"
        onClick={() => {
          setActiveSection(item.value);
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ManagementShell({ user, securityHidden, onLogout, children }: { user: ManagementUser; securityHidden: boolean; onLogout: () => void; children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState(user.role === "moderator" ? "resellers" : "clients");
  const [menuItems, setMenuItems] = useState<ManagementNavItem[]>(user.role === "moderator" ? moderatorNavigationItems : resellerNavigationItems);
  const brandColor = user.brandColor || "#dc2626";
  const groupedItems = menuItems.reduce<Record<string, ManagementNavItem[]>>((groups, item) => {
    (groups[item.group] ||= []).push(item);
    return groups;
  }, {});

  return (
    <ManagementNavigationContext.Provider value={{ activeSection, setActiveSection, menuItems, setMenuItems }}>
      <SidebarProvider defaultOpen className="min-h-screen bg-[#0b0b0b] text-white">
        <Sidebar collapsible="offcanvas" className="z-[60] border-neutral-800 bg-[#111111] text-white [&_[data-sidebar=sidebar-inner]]:bg-[#111111] [&_[data-sidebar=sidebar-inner]]:shadow-2xl">
          <SidebarHeader className="shrink-0 border-b border-neutral-800 bg-[#111111] px-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-[0.12em]" style={{ color: brandColor }}>{user.brandName || "SHELBY PANEL"}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Navegação do painel</p>
              </div>
              <SidebarTrigger className="shrink-0 text-neutral-300 hover:bg-white/10 hover:text-white" />
            </div>
          </SidebarHeader>
          <SidebarContent className="min-h-0 overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-700">
            {Object.entries(groupedItems).map(([group, items]) => (
              <SidebarGroup key={group} className="mb-2 p-1">
                <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500 group-data-[collapsible=icon]:hidden">{group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => <ManagementNavButton key={item.value} item={item} />)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarSeparator className="bg-neutral-800" />
          <SidebarFooter className="shrink-0 gap-3 border-t border-neutral-800 bg-[#111111] p-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 group-data-[collapsible=icon]:hidden">Painel online</span>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="button" className="text-neutral-300 hover:bg-red-950/40 hover:text-red-300" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  <span>Sair da conta</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0 bg-[#0b0b0b]">
          <header className="sticky top-0 z-50 flex min-h-16 items-center justify-between border-b border-neutral-800 bg-[#111111]/95 px-3 py-3 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="text-neutral-300 hover:bg-white/10 hover:text-white" />
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-[0.12em] sm:text-xl" style={{ color: brandColor }}>{user.brandName || "SHELBY PANEL"}</p>
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Área de {user.role === "moderator" ? "moderador" : "revendedor"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden text-sm text-neutral-300 sm:inline">Olá, <strong className="text-white">{user.username}</strong></span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">Online</span>
            </div>
          </header>
          {securityHidden && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505] p-6 text-center">
              <div><Shield className="mx-auto mb-3 h-10 w-10 text-red-500" /><p className="text-lg font-bold text-white">Conteúdo protegido</p><p className="mt-1 text-sm text-neutral-400">Retorne a esta janela para continuar visualizando o painel.</p></div>
            </div>
          )}
          <main className="w-full overflow-x-hidden p-3 sm:p-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ManagementNavigationContext.Provider>
  );
}

export default function Home() {
  const utils = trpc.useUtils();
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });



  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [deviceLimitError, setDeviceLimitError] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetCodeHint, setResetCodeHint] = useState("");
  const [securityHidden, setSecurityHidden] = useState(false);
  const [activeClients, setActiveClients] = useState(2490);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const variation = Math.floor(Math.random() * 17) - 8;
      setActiveClients((current) => Math.max(2480, Math.min(2505, current + variation)));
    }, 3500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    // A proteção contra compartilhamento continua apenas como aviso visual.
    // Copiar, colar, selecionar texto, menu contextual e atalhos ficam liberados.
    const onVisibility = () => setSecurityHidden(document.visibilityState !== "visible");
    const onBlur = () => setSecurityHidden(true);
    const onFocus = () => setSecurityHidden(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setDeviceLimitError(false);
      setResetCode("");
      setResetCodeHint("");
      toast.success("Login realizado com sucesso!");
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      const isDeviceLimit = err.message.toLowerCase().includes("limite de dispositivos") || err.message.toLowerCase().includes("limite excedido");
      const codeMatch = err.message.match(/:\s*([A-Z0-9]{4})$/);
      setResetCodeHint(isDeviceLimit && codeMatch ? codeMatch[1] : "");
      setDeviceLimitError(isDeviceLimit);
      toast.error(err.message);
    },
  });

  const resetSessionWithCodeMutation = trpc.auth.resetSessionWithCode.useMutation({
    onSuccess: () => {
      toast.success("Sessão resetada. Entrando novamente...");
      setDeviceLimitError(false);
      setResetCode("");
      setResetCodeHint("");
      const deviceIdentifier = localStorage.getItem("device_id") || Math.random().toString(36).substring(2);
      localStorage.setItem("device_id", deviceIdentifier);
      loginMutation.mutate({ username: username.trim(), password, deviceIdentifier });
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (user || authLoading) return;
    try {
      const saved = JSON.parse(localStorage.getItem("saved_store_login") || "null");
      if (!saved?.username || !saved?.password) return;
      const deviceIdentifier = localStorage.getItem("device_id") || Math.random().toString(36).substring(2);
      localStorage.setItem("device_id", deviceIdentifier);
      setUsername(saved.username);
      setPassword(saved.password);
      loginMutation.mutate({ username: saved.username, password: saved.password, deviceIdentifier });
    } catch { localStorage.removeItem("saved_store_login"); }
  }, [user, authLoading]);

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

    setDeviceLimitError(false);
    loginMutation.mutate({ username: username.trim(), password, deviceIdentifier });
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
      <div className="relative min-h-screen overflow-hidden bg-[#070707] text-white flex items-center justify-center px-4 py-8 font-sans">
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-[-6%] bg-[url('/assets/shelby-login-bg.png')] bg-cover bg-center lg:bg-[position:center_18%] blur-[2px] animate-shelby-login-bg" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/35" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,rgba(127,29,29,0.3),transparent_42%)]" />
          <div className="absolute inset-0 bg-black/25" />
        </div>

        <div className="relative z-10 grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]">
          <div className="hidden lg:block max-w-xl space-y-5 px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-red-300 backdrop-blur-md">
              Acesso seguro
            </div>
            <h1 className="text-5xl font-black leading-none tracking-[0.16em] text-white drop-shadow-2xl xl:text-6xl">SHELBY<br /><span className="text-red-600">PANEL</span></h1>
            <p className="max-w-md text-sm leading-6 text-neutral-300">Gerencie seus acessos, produtos e clientes em um só lugar.</p>
            <div className="h-px w-24 bg-red-600/80" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Painel de acesso & distribuição</p>
          </div>

          <div className="w-full max-w-[360px] justify-self-center rounded-2xl border border-white/15 bg-black/65 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-6 lg:justify-self-end">
            <div className="mb-5 text-center space-y-2 lg:hidden">
              <h1 className="text-3xl font-black tracking-[0.14em] text-red-600 drop-shadow-lg">SHELBY PANEL</h1>
              <p className="text-xs text-neutral-300">Painel de Acesso & Distribuição</p>
            </div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">Bem-vindo</p>
                <h2 className="mt-1 text-lg font-black tracking-wide text-white">Entrar no painel</h2>
              </div>
              <Lock className="h-5 w-5 text-red-500" />
            </div>
            <div className="mb-5 grid grid-cols-2 gap-2" aria-label="Estatísticas de acesso">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Clientes</p>
                <p className="mt-1 text-xl font-black text-amber-300">3.789</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Clientes ativos</p>
                <p className="mt-1 text-xl font-black text-emerald-300" aria-live="polite">{activeClients.toLocaleString("pt-BR")}</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-200">Usuário</label>
                <Input
                  className="h-11 border-white/15 bg-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-red-500"
                  placeholder="Ex: seu login"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-200">Senha</label>
                <Input
                  type="password"
                  className="h-11 border-white/15 bg-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-red-500"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 w-full bg-red-600 font-bold text-white shadow-lg shadow-red-950/40 transition-all hover:bg-red-700 hover:shadow-red-900/50" disabled={loginMutation.isPending || resetSessionWithCodeMutation.isPending}>
                {loginMutation.isPending ? "Entrando..." : "Entrar na Plataforma"}
              </Button>
              <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Ainda não tem acesso?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href="/loja" className="flex min-h-11 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 text-center text-xs font-black text-emerald-300 transition hover:bg-emerald-900/50 hover:text-white">
                    Comprar um produto
                  </Link>
                  <Link href="/seja-revendedor" className="flex min-h-11 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 text-center text-xs font-black text-amber-300 transition hover:bg-amber-900/50 hover:text-white">
                    Quero ser revendedor
                  </Link>
                </div>
              </div>
              {deviceLimitError && (
                <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-left">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-amber-300">Limite de dispositivos</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-100/80">Resete seu login usando o código para poder entrar novamente.</p>
                    {resetCodeHint && <p className="mt-2 rounded-md border border-amber-400/40 bg-black/30 px-3 py-2 text-center text-lg font-black tracking-[0.15em] text-amber-200">{resetCodeHint}</p>}
                  </div>
                  <Input
                    type="text"
                    autoComplete="off"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Digite o código"
                    className="h-10 border-amber-500/40 bg-black/30 text-white placeholder:text-neutral-500 focus-visible:ring-amber-500"
                  />
                  <Button
                    type="button"
                    className="h-10 w-full bg-amber-600 font-bold text-black hover:bg-amber-500"
                    disabled={resetSessionWithCodeMutation.isPending || !resetCode.trim() || loginMutation.isPending}
                    onClick={() => resetSessionWithCodeMutation.mutate({ username: username.trim(), password, resetCode })}
                  >
                    {resetSessionWithCodeMutation.isPending ? "Resetando sessão..." : "Resetar sessão e acessar"}
                  </Button>
                </div>
              )}
            </form>
            <div className="mt-6 space-y-2 border-t border-white/10 pt-5 text-center">
              <p className="text-xs text-neutral-400">Entre no nosso Discord oficial</p>
              <a href="https://discord.gg/Nge3JfEZfb" target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center rounded-md border border-indigo-400/30 bg-indigo-950/50 px-4 py-2.5 text-sm font-bold text-indigo-200 transition-colors hover:bg-indigo-900/70 hover:text-white">
                Entrar no Discord Oficial
              </a>
              <p className="text-[11px] font-semibold text-amber-300/90">Abra este link em um navegador como Chrome ou Safari.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user.role === "moderator" || user.role === "reseller") {
    return (
      <ManagementShell
        user={{
          username: user.username,
          role: user.role,
          brandName: user.brandName,
          brandColor: user.brandColor,
        }}
        securityHidden={securityHidden}
        onLogout={() => logoutMutation.mutate()}
      >
        {user.role === "moderator" ? <ModeratorDashboard /> : <ResellerDashboard />}
      </ManagementShell>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white font-sans flex flex-col">
      <header className="border-b border-neutral-800 bg-[#111] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-wider" style={{ color: user.brandColor || "#dc2626" }}>{user.brandName || "SHELBY PANEL"}</span>
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

function StoreAdmin() {
  const utils = trpc.useUtils();
  const { data: products } = trpc.store.listAdminProducts.useQuery();
  const { data: sales } = trpc.store.salesDashboard.useQuery();
  const [salesSearch, setSalesSearch] = useState("");
  const toggleStoreClient = trpc.moderator.toggleUserStatus.useMutation({ onSuccess: () => utils.store.salesDashboard.invalidate() });
  const resetStoreSession = trpc.moderator.resetUserSession.useMutation({ onSuccess: () => toast.success("Sessões resetadas.") });
  const deleteStoreClient = trpc.moderator.deleteUser.useMutation({ onSuccess: () => { toast.success("Login excluído."); utils.store.salesDashboard.invalidate(); } });
  const resetStorePassword = trpc.moderator.resetUserPassword.useMutation({ onSuccess: () => toast.success("Senha alterada com sucesso.") });
  const [token, setToken] = useState("");
  const [form, setForm] = useState<{ id?: number; name: string; type: "advanced" | "ios" | "ios_ipa" | "panel_ios" | "panel_android" | "proxy_android_clientes"; category: string; description: string; imageUrl: string; price: string; isActive: boolean }>({ name: "", type: "advanced", category: "Proxy", description: "", imageUrl: "", price: "", isActive: true });
  const save = trpc.store.saveProduct.useMutation({ onSuccess: () => { toast.success("Produto salvo."); utils.store.listAdminProducts.invalidate(); setForm({ name: "", type: "advanced", category: "Proxy", description: "", imageUrl: "", price: "", isActive: true }); }, onError: (e) => toast.error(e.message) });
  const remove = trpc.store.deleteProduct.useMutation({ onSuccess: () => utils.store.listAdminProducts.invalidate() });
  const saveSettings = trpc.store.saveSettings.useMutation({ onSuccess: () => { toast.success("Token do Mercado Pago salvo com segurança."); setToken(""); }, onError: (e) => toast.error(e.message) });
  const field = (key: keyof typeof form, placeholder: string) => <Input value={String(form[key])} placeholder={placeholder} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} className="border-neutral-700 bg-[#202020] text-white" />;
  return <div className="space-y-5">
    <Card className="border-blue-800 bg-[#141414] text-white"><CardHeader><CardTitle className="text-white">Vendas pelo site</CardTitle><Input value={salesSearch} onChange={(e) => setSalesSearch(e.target.value)} placeholder="Pesquisar login, produto ou pedido" className="mt-3 border-neutral-700 bg-[#222] text-white" /></CardHeader><CardContent><div className="mb-5 grid gap-3 sm:grid-cols-4"><div className="rounded-md bg-[#202020] p-3"><p className="text-xs text-neutral-500">Pedidos</p><p className="text-2xl font-black">{sales?.stats.total || 0}</p></div><div className="rounded-md bg-[#202020] p-3"><p className="text-xs text-neutral-500">Pagos</p><p className="text-2xl font-black text-emerald-400">{sales?.stats.approved || 0}</p></div><div className="rounded-md bg-[#202020] p-3"><p className="text-xs text-neutral-500">Pendentes</p><p className="text-2xl font-black text-amber-300">{sales?.stats.pending || 0}</p></div><div className="rounded-md bg-[#202020] p-3"><p className="text-xs text-neutral-500">Faturamento</p><p className="text-2xl font-black text-blue-300">R$ {(sales?.stats.revenue || 0).toFixed(2).replace(".", ",")}</p></div></div><div className="space-y-2">{sales?.clients.filter((order: any) => order.client && `${order.client.username} ${order.productName} ${order.id}`.toLowerCase().includes(salesSearch.trim().toLowerCase())).map((order: any) => <div key={order.id} className="flex flex-col justify-between gap-3 rounded-md border border-neutral-800 bg-[#202020] p-3 sm:flex-row sm:items-center"><div><p className="font-bold">{order.client.username} <span className="ml-2 text-xs font-normal text-blue-300">{order.productName}</span></p><p className="text-xs text-neutral-500">Pedido #{order.id} · {order.status} · {order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR") : ""}</p><p className="mt-1 break-all font-mono text-xs text-cyan-300">Key: {order.key?.keyValue || "Nenhuma Key vinculada"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="border-amber-700 bg-transparent text-amber-300" onClick={() => resetStoreSession.mutate({ userId: order.client.id })}>Resetar sessão</Button><Button size="sm" variant="outline" className="border-blue-700 bg-transparent text-blue-300" onClick={() => toggleStoreClient.mutate({ userId: order.client.id })}>{order.client.isActive ? "Bloquear" : "Ativar"}</Button><Button size="sm" variant="outline" className="border-violet-700 bg-transparent text-violet-300" onClick={() => { const newPassword = prompt(`Nova senha para ${order.client.username}:`); if (newPassword && newPassword.length >= 4) resetStorePassword.mutate({ userId: order.client.id, newPassword }); else if (newPassword) toast.error("A senha precisa ter pelo menos 4 caracteres."); }}>Trocar senha</Button><Button size="sm" variant="outline" className="border-red-800 bg-transparent text-red-300" onClick={() => deleteStoreClient.mutate({ userId: order.client.id })}>Excluir</Button></div></div>)}</div></CardContent></Card>
    <Card className="border-emerald-800 bg-[#141414] text-white"><CardHeader><CardTitle className="text-white">Configurar Mercado Pago</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm text-neutral-400">Cole o Access Token no painel. Ele não é exibido novamente nem enviado ao navegador.</p><div className="flex flex-col gap-3 sm:flex-row"><Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-..." className="border-neutral-700 bg-[#202020] text-white" /><Button disabled={saveSettings.isPending || token.length < 20} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => saveSettings.mutate({ mercadoPagoToken: token })}>Salvar token</Button></div></CardContent></Card>
    <Card className="border-red-800 bg-[#141414] text-white"><CardHeader><CardTitle className="text-white">Vitrine de produtos</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-neutral-400">Cadastre somente produtos que já existem no gerador. A vitrine permanece oculta até ativação.</p><div className="grid gap-3 md:grid-cols-2">{field("name", "Nome do produto")}<select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value as typeof current.type }))} className="h-10 rounded-md border border-neutral-700 bg-[#202020] px-3 text-sm text-white">{[{ value: "advanced", label: "Android Advanced" }, { value: "ios", label: "Proxy iOS" }, { value: "ios_ipa", label: "Proxy iOS IPA" }, { value: "panel_ios", label: "Painel iOS" }, { value: "panel_android", label: "Painel Android" }, { value: "proxy_android_clientes", label: "Proxy Android Clientes" }].map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}</select>{field("category", "Categoria")}{field("price", "Preço em reais (ex.: 19.90)")}{field("imageUrl", "URL HTTPS da imagem")}</div><textarea value={form.description} placeholder="Descrição do produto" onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} className="mt-3 min-h-24 w-full rounded-md border border-neutral-700 bg-[#202020] p-3 text-sm text-white placeholder:text-neutral-500" /><div className="mt-3 flex gap-3"><Button className="bg-red-600 hover:bg-red-700" disabled={save.isPending} onClick={() => save.mutate({ ...form, price: Number(form.price) })}>{form.id ? "Salvar alterações" : "Adicionar produto"}</Button>{form.id && <Button variant="outline" className="border-neutral-700 bg-transparent text-white" onClick={() => setForm({ name: "", type: "advanced", category: "Proxy", description: "", imageUrl: "", price: "", isActive: true })}>Cancelar</Button>}</div><div className="mt-6 space-y-2">{products?.map((product: any) => <div key={product.id} className="flex flex-col justify-between gap-3 rounded-md border border-neutral-800 bg-[#202020] p-3 sm:flex-row sm:items-center"><div><p className="font-bold text-white">{product.name} <span className="ml-2 text-xs font-normal text-emerald-400">R$ {Number(product.price).toFixed(2)}</span></p><p className="text-xs text-neutral-500">{product.category} · {product.type} · {product.isActive ? "Ativo" : "Oculto"}</p></div><Button size="sm" variant="outline" className="border-blue-700 bg-transparent text-blue-300" onClick={() => setForm({ id: product.id, name: product.name, type: product.type, category: product.category, description: product.description, imageUrl: product.imageUrl || "", price: String(product.price), isActive: product.isActive })}>Editar</Button><Button size="sm" variant="outline" className="border-red-800 bg-transparent text-red-300 hover:bg-red-950" onClick={() => remove.mutate({ id: product.id })}>Excluir</Button></div>)}</div></CardContent></Card>
  </div>;
}

function ModeratorDashboard() {
  const { activeSection, setActiveSection } = useManagementNavigation();
  const { data: stats } = trpc.moderator.dashboardStats.useQuery();
  const { data: resellerPlansAdmin } = trpc.store.listResellerPlans.useQuery();
  const saveResellerPlan = trpc.moderator.saveResellerPlan.useMutation({ onSuccess: () => toast.success("Plano salvo."), onError: (e) => toast.error(e.message) });
  const { data: resellerConfig } = trpc.moderator.getResellerConfig.useQuery();
  const saveResellerConfig = trpc.moderator.saveResellerConfig.useMutation({ onSuccess: () => toast.success("Configurações salvas permanentemente."), onError: (e) => toast.error(e.message) });
  const { data: resellers, refetch: refetchResellers } = trpc.moderator.listResellers.useQuery();
  const { data: directClientBanner, refetch: refetchDirectClientBanner } = trpc.moderator.getDirectClientBanner.useQuery();
  const { data: clients, refetch: refetchClients } = trpc.moderator.listClients.useQuery();
  const { data: keysList, refetch: refetchKeys } = trpc.moderator.listKeys.useQuery();
  const { data: downloadsList, refetch: refetchDownloads } = trpc.moderator.listDownloads.useQuery();
  const { data: tutorialsList, refetch: refetchTutorials } = trpc.moderator.listTutorials.useQuery();
  const { data: announcementsList, refetch: refetchAnnouncements } = trpc.moderator.listAnnouncements.useQuery();
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
  const [newResellerCreditsProxyAndroidClientes, setNewResellerCreditsProxyAndroidClientes] = useState(0);
  const [newResellerBrandName, setNewResellerBrandName] = useState("");
  const [newResellerDiscordUrl, setNewResellerDiscordUrl] = useState("");
  const [newResellerColor, setNewResellerColor] = useState("#dc2626");
  const [newResellerIsPremium, setNewResellerIsPremium] = useState(false);

  const [newKeyVal, setNewKeyVal] = useState("");
  const [newKeyType, setNewKeyType] = useState<ActiveProductType>("advanced");
  const [batchKeysText, setBatchKeysText] = useState("");
  const [batchKeyType, setBatchKeyType] = useState<ActiveProductType>("advanced");

  const [dlTitle, setDlTitle] = useState("");
  const [dlDesc, setDlDesc] = useState("");
  const [dlVersion, setDlVersion] = useState("1.0");
  const [dlUrl, setDlUrl] = useState("");
  const [dlType, setDlType] = useState<"basic" | "advanced">("advanced");
  const [editingDownload, setEditingDownload] = useState<any | null>(null);

  const [tutTitle, setTutTitle] = useState("");
  const [tutDesc, setTutDesc] = useState("");
  const [tutUrl, setTutUrl] = useState("");
  const [tutType, setTutType] = useState<ActiveProductType>("advanced");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementProductType, setAnnouncementProductType] = useState("all");
  const [announcementDuration, setAnnouncementDuration] = useState(5);
  const [announcementIsActive, setAnnouncementIsActive] = useState(true);

  const [modClientUser, setModClientUser] = useState("");
  const [modClientPass, setModClientPass] = useState("");
  const [modClientType, setModClientType] = useState<ActiveProductType>("advanced");
  const [modClientMaxDevices, setModClientMaxDevices] = useState(1);
  const [keysRevealed, setKeysRevealed] = useState(false);
  const [keyGlobalSearch, setKeyGlobalSearch] = useState("");
  const keyMatches = (key: any, query: string) => { const search = query.trim().toLowerCase(); return !search || `${key.id} ${key.keyValue} ${key.type} ${key.isUsed ? "usada" : "disponivel"} ${key.isBanned ? "banida" : "ativa"}`.toLowerCase().includes(search); };
  const [modCreatedCredentials, setModCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [modBulkQuantity, setModBulkQuantity] = useState(1);
  const [modBulkCredentials, setModBulkCredentials] = useState<Array<{ username: string; password: string }>>([]);
  const [modBulkGenerating, setModBulkGenerating] = useState(false);
  const [modRenewingClient, setModRenewingClient] = useState<{ id: number; username: string } | null>(null);
  const [modClientSearch, setModClientSearch] = useState("");
  const [modLoginFilter, setModLoginFilter] = useState<"all" | "logged" | "never">("all");
  const [keyAuditType, setKeyAuditType] = useState<"all" | "basic" | "advanced" | "ios" | "panel_ios" | "panel_legitimo">("all");
  const [keyAuditSearch, setKeyAuditSearch] = useState("");
  const [keyAuditFrom, setKeyAuditFrom] = useState("");
  const [keyAuditTo, setKeyAuditTo] = useState("");
  const [resellerPreviewPlans, setResellerPreviewPlans] = useState([{ name: "Revendedor Basic", price: "49,90", credits: 10 }, { name: "Revendedor Premium", price: "99,90", credits: 30 }]);
  useEffect(() => { if (resellerPlansAdmin?.length) setResellerPreviewPlans(resellerPlansAdmin.map((plan: any) => ({ id: plan.id, name: plan.name, price: String(plan.price).replace(".", ","), credits: plan.initialCredits, isPremium: plan.isPremium } as any))); }, [resellerPlansAdmin]);
  const [creditValues, setCreditValues] = useState<Record<string, string>>({ advanced: "2,00", ios: "2,00", ios_ipa: "3,00", panel_ios: "4,00", panel_android: "4,00", proxy_android_clientes: "3,00" });
  const [creditCalcType, setCreditCalcType] = useState("advanced");
  const [creditCalcQuantity, setCreditCalcQuantity] = useState(10);
  const [resellerVisibleProducts, setResellerVisibleProducts] = useState<Record<string, boolean>>({ advanced: true, ios: true, ios_ipa: true, panel_ios: true, panel_android: true, proxy_android_clientes: true });
  const [resellerCreditProducts, setResellerCreditProducts] = useState<Record<string, boolean>>({ advanced: true, ios: true, ios_ipa: true, panel_ios: true, panel_android: true, proxy_android_clientes: true });
  useEffect(() => { if (resellerConfig?.creditValues && Object.keys(resellerConfig.creditValues).length) setCreditValues((current) => ({ ...current, ...resellerConfig.creditValues })); if (resellerConfig?.visibleProducts && Object.keys(resellerConfig.visibleProducts).length) setResellerVisibleProducts((current) => ({ ...current, ...resellerConfig.visibleProducts })); if (resellerConfig?.creditProducts && Object.keys(resellerConfig.creditProducts).length) setResellerCreditProducts((current) => ({ ...current, ...resellerConfig.creditProducts })); }, [resellerConfig]);


  const deleteExpiredKeysMutation = trpc.moderator.deleteExpiredKeys.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deletedCount} chaves expiradas excluídas com sucesso!`);
      refetchKeys();
    },
    onError: (err) => toast.error(err.message),
  });
  const [modRenewType, setModRenewType] = useState<"basic" | "advanced" | "ios" | "panel_ios" | "panel_legitimo" | "panel_android" | "ios_ipa">("advanced");

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

  const handleModeratorBulkGenerate = async () => {
    const quantity = Number(modBulkQuantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      toast.error("Informe uma quantidade inteira maior que zero.");
      return;
    }
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const generatedUsernames = new Set<string>();
    const results: Array<{ username: string; password: string }> = [];
    setModBulkGenerating(true);
    setModBulkCredentials([]);
    try {
      for (let index = 0; index < quantity; index += 1) {
        let username = "";
        do {
          username = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
        } while (generatedUsernames.has(username));
        generatedUsernames.add(username);
        const password = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");
        const result = await modCreateClientMutation.mutateAsync({ username, password, type: modClientType as any, maxDevices: modClientMaxDevices });
        results.push({ username: result.createdUsername, password: result.createdPassword });
      }
      setModBulkCredentials(results);
      toast.success(`${results.length} login(s) gerado(s) com sucesso!`);
      refetchClients();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível concluir a geração em lote.");
      setModBulkCredentials(results);
      refetchClients();
    } finally {
      setModBulkGenerating(false);
    }
  };

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
      setNewResellerBrandName("");
      setNewResellerDiscordUrl("");
      setNewResellerColor("#dc2626");
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

  const updateResellerBrandingMutation = trpc.moderator.updateResellerBranding.useMutation({
    onSuccess: () => { toast.success("Personalização do revendedor atualizada!"); refetchResellers(); },
    onError: (e) => toast.error(e.message),
  });

  const setResellerBannerUrlMutation = trpc.moderator.setResellerBannerUrl.useMutation({
    onSuccess: () => { toast.success("Link do banner atualizado!"); refetchResellers(); },
    onError: (e) => toast.error(e.message),
  });

  const setResellerBannerVideoUrlMutation = trpc.moderator.setResellerBannerVideoUrl.useMutation({
    onSuccess: () => { toast.success("Vídeo do banner atualizado!"); refetchResellers(); },
    onError: (e) => toast.error(e.message),
  });

  const setDirectClientBannerUrlMutation = trpc.moderator.setDirectClientBannerUrl.useMutation({
    onSuccess: () => { toast.success("Banner dos clientes diretos atualizado!"); refetchDirectClientBanner(); },
    onError: (e) => toast.error(e.message),
  });

  const setDirectClientBannerVideoUrlMutation = trpc.moderator.setDirectClientBannerVideoUrl.useMutation({
    onSuccess: () => { toast.success("Vídeo dos clientes diretos atualizado!"); refetchDirectClientBanner(); },
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

  const deleteAndroidKeyMutation = trpc.moderator.deleteAndroidKey.useMutation({
    onSuccess: () => { toast.success("Key do Painel Android removida!"); refetchKeys(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteHgKeysMutation = trpc.moderator.deleteHgKeys.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.deletedCount} keys iniciadas com 'HG' foram removidas com sucesso!`);
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

  const updateTutorialTypeMutation = trpc.moderator.updateTutorialType.useMutation({
    onSuccess: () => { toast.success("Tipo do tutorial atualizado!"); refetchTutorials(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteTutorialMutation = trpc.moderator.deleteTutorial.useMutation({
    onSuccess: () => {
      toast.success("Tutorial excluído!");
      refetchTutorials();
    },
  });

  const addAnnouncementMutation = trpc.moderator.addAnnouncement.useMutation({
    onSuccess: () => {
      toast.success("Aviso cadastrado!");
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementDuration(5);
      setAnnouncementIsActive(true);
      refetchAnnouncements();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleAnnouncementMutation = trpc.moderator.toggleAnnouncement.useMutation({
    onSuccess: () => { toast.success("Status do aviso atualizado!"); refetchAnnouncements(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteAnnouncementMutation = trpc.moderator.deleteAnnouncement.useMutation({
    onSuccess: () => { toast.success("Aviso removido!"); refetchAnnouncements(); },
    onError: (e) => toast.error(e.message),
  });

  const exportKeys = () => {
    if (!keysList) return;
    const text = keysList.map((k) => k.keyValue).join("\\n");
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

      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader>
          <CardTitle className="text-white">Banner dos clientes diretos</CardTitle>
          <p className="text-xs text-neutral-400">Este banner aparece somente nos clientes criados pelo Moderador. Clientes de revendedores continuam usando o banner configurado em cada revendedor.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="border-emerald-700 text-emerald-300 bg-emerald-950/30" disabled={setDirectClientBannerUrlMutation.isPending} onClick={() => {
              const bannerUrl = prompt("Link público HTTPS da foto para os clientes diretos. Deixe vazio para remover:", directClientBanner?.bannerUrl || "");
              if (bannerUrl === null) return;
              setDirectClientBannerUrlMutation.mutate({ bannerUrl });
            }}>
              {setDirectClientBannerUrlMutation.isPending ? "Salvando..." : directClientBanner?.bannerUrl ? "Foto ✓" : "Foto"}
            </Button>
            <Button size="sm" variant="outline" className="border-fuchsia-700 text-fuchsia-300 bg-fuchsia-950/30" disabled={setDirectClientBannerVideoUrlMutation.isPending} onClick={() => {
              const videoUrl = prompt("Link HTTPS do vídeo para os clientes diretos. Aceita link direto .mp4/.webm ou página pública do MediaFire. Deixe vazio para remover:", directClientBanner?.bannerVideoUrl || "");
              if (videoUrl === null) return;
              setDirectClientBannerVideoUrlMutation.mutate({ videoUrl });
            }}>
              {setDirectClientBannerVideoUrlMutation.isPending ? "Salvando..." : directClientBanner?.bannerVideoUrl ? "Vídeo ✓" : "Vídeo"}
            </Button>
          </div>
          <p className="text-xs text-neutral-500">Se os dois forem definidos, o vídeo aparece primeiro e a foto funciona como fallback. O login do Moderador não exibe este banner.</p>
        </CardContent>
      </Card>

      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader><CardTitle className="text-white">Avisos pós-login por produto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-neutral-400">O aviso aparece ao cliente após entrar no painel e desaparece ao fim da contagem configurada.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="Título do aviso" className="bg-[#1f1f1f] border-neutral-700 text-white" />
            <select value={announcementProductType} onChange={(e) => setAnnouncementProductType(e.target.value)} className="h-10 rounded-md border border-neutral-700 bg-[#1f1f1f] px-3 text-sm text-white">
              <option value="all">Todos os produtos</option>
              <option value="advanced">Proxy Advanced</option>
              <option value="panel_ios">Painel iOS</option>
              <option value="panel_android">Painel Android</option>
              <option value="ios_ipa">Proxy iOS IPA</option>
            </select>
          </div>
          <textarea value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} placeholder="Mensagem exibida ao cliente" rows={3} className="w-full rounded-md border border-neutral-700 bg-[#1f1f1f] p-3 text-sm text-white placeholder:text-neutral-500" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-neutral-300">Duração (segundos)</label>
            <Input type="number" min={1} max={300} value={announcementDuration} onChange={(e) => setAnnouncementDuration(Math.max(1, Math.min(300, Number(e.target.value) || 1)))} className="w-28 bg-[#1f1f1f] border-neutral-700 text-white" />
            <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={announcementIsActive} onChange={(e) => setAnnouncementIsActive(e.target.checked)} /> Ativo imediatamente</label>
            <Button onClick={() => addAnnouncementMutation.mutate({ title: announcementTitle, message: announcementMessage, productType: announcementProductType as any, durationSeconds: announcementDuration, isActive: announcementIsActive })} disabled={addAnnouncementMutation.isPending || !announcementTitle.trim() || !announcementMessage.trim()} className="bg-red-600 hover:bg-red-700">Adicionar aviso</Button>
          </div>
          <div className="space-y-2">
            {(announcementsList || []).map((announcement: any) => (
              <div key={announcement.id} className="rounded-md border border-neutral-800 bg-[#1b1b1b] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-semibold">{announcement.title}</span><span className="ml-2 text-xs text-neutral-400">{announcement.productType === "all" ? "Todos" : announcement.productType} · {announcement.durationSeconds}s</span></div>
                  <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => toggleAnnouncementMutation.mutate({ announcementId: announcement.id, isActive: !announcement.isActive })}>{announcement.isActive ? "Desativar" : "Ativar"}</Button><Button size="sm" variant="destructive" onClick={() => deleteAnnouncementMutation.mutate({ announcementId: announcement.id })}><Trash2 className="w-3 h-3" /></Button></div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{announcement.message}</p>
                <Badge className={announcement.isActive ? "mt-2 bg-emerald-700" : "mt-2 bg-neutral-700"}>{announcement.isActive ? "Ativo" : "Inativo"}</Badge>
              </div>
            ))}
            {announcementsList?.length === 0 && <p className="text-sm text-neutral-500">Nenhum aviso cadastrado.</p>}
          </div>
        </CardContent>
      </Card>

      {(() => {
        if (!stats) return null;
        const stockLabels: Record<string, string> = { advanced: "Proxy Advanced", panel_ios: "Painel iOS", panel_android: "Painel Android", proxy_android_clientes: "Proxy Android Clientes", ios_ipa: "Proxy iOS IPA" };
        const lowStock = Object.entries(stockLabels).filter(([type]) => Number((stats?.stock as any)?.[type] || 0) <= 3);
        const lowStockTotal = lowStock.reduce((sum, [type]) => sum + Number((stats?.stock as any)?.[type] || 0), 0);
        return <Card className="bg-[#141414] border-neutral-800 text-white"><CardContent className="p-4"><div className="flex items-start gap-3"><KeyRound className="w-6 h-6 text-amber-400 mt-0.5 shrink-0" /><div className="w-full"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-lg text-white">Estoque disponível de Keys</p>{lowStock.length > 0 && <Badge className="bg-red-900/70 border-red-600 text-red-100"><AlertTriangle className="w-3 h-3 mr-1" /> {lowStock.length} tipo(s) em estoque baixo</Badge>}</div><p className="text-xs text-neutral-400 mt-1">Quantidade atual de Keys ativas, não usadas e não banidas.</p><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 mt-3">{Object.entries(stockLabels).map(([type, label]) => { const count = Number((stats?.stock as any)?.[type] || 0); const isLow = count <= 3; return <div key={type} className={`rounded-md border px-3 py-2 ${isLow ? "border-red-600 bg-red-950/60" : "border-neutral-700 bg-[#202020]"}`}><p className={`text-xs font-bold ${isLow ? "text-red-200" : "text-neutral-300"}`}>{label}</p><p className={`text-lg font-black ${isLow ? "text-red-400" : "text-emerald-400"}`}>{count} Keys disponíveis</p></div>; })}</div>{lowStock.length > 0 && <p className="text-xs font-bold text-red-300 mt-3"><AlertTriangle className="w-3 h-3 inline mr-1" /> Atenção: {lowStockTotal} Keys somadas estão em tipos com estoque de 3 ou menos. Reponha o estoque.</p>}</div></div></CardContent></Card>;
      })()}

      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
        <TabsContent value="store" className="space-y-4"><StoreAdmin /></TabsContent>
        <div className="sr-only">
          <div className="mb-2"><h2 className="text-sm font-black uppercase tracking-wider text-white">Centro de Controle do Moderador</h2><p className="text-xs text-neutral-500">Gerencie usuários, painéis, estoque, conteúdo e auditoria em seções separadas.</p></div>
          <TabsList className="bg-[#141414] border border-neutral-800 p-2 flex flex-wrap items-center gap-1 w-full h-auto">
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Operação</span>
            <TabsTrigger value="resellers" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Revendedores</TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Clientes</TabsTrigger>
            <span className="mx-1 h-5 w-px bg-neutral-700" />
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Painéis</span>
            <TabsTrigger value="iosPanel" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white">Painel iOS</TabsTrigger>
            <TabsTrigger value="androidPanel" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white">Painel Android</TabsTrigger>
            <TabsTrigger value="proxyAndroidClientesPanel" className="data-[state=active]:bg-lime-600 data-[state=active]:text-white text-white">Proxy Android Clientes</TabsTrigger>
            <TabsTrigger value="iosIpaPanel" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white">Proxy iOS IPA</TabsTrigger>
            <span className="mx-1 h-5 w-px bg-neutral-700" />
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Keys</span>
            <TabsTrigger value="androidKeys" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white">Keys Android</TabsTrigger>
            <TabsTrigger value="proxyAndroidClientesKeys" className="data-[state=active]:bg-lime-600 data-[state=active]:text-white text-white">Keys Proxy Android Clientes</TabsTrigger>
            <TabsTrigger value="iosIpaKeys" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white">Keys iOS IPA</TabsTrigger>
            <TabsTrigger value="keys" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Gerenciar Keys</TabsTrigger>
            <TabsTrigger value="bannedKeys" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Banidas / Usadas</TabsTrigger>
            <span className="mx-1 h-5 w-px bg-neutral-700" />
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Conteúdo e auditoria</span>
            <TabsTrigger value="downloads" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Downloads</TabsTrigger>
            <TabsTrigger value="tutorials" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Tutoriais</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Logs</TabsTrigger>
            <TabsTrigger value="keyAudit" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-white">Keys por Revendedor</TabsTrigger>
            <TabsTrigger value="announcements" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Avisos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="announcements" className="space-y-4">
          <Card className="bg-[#141414] border-red-800 text-white">
            <CardHeader><CardTitle className="text-white">Gerenciar avisos pós-login</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-neutral-300">Cadastre uma mensagem para aparecer aos clientes do produto selecionado após o login.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="Título do aviso" className="bg-[#222] border-neutral-700 text-white" />
                <select value={announcementProductType} onChange={(e) => setAnnouncementProductType(e.target.value)} className="h-10 rounded-md border border-neutral-700 bg-[#222] px-3 text-sm text-white">
                </select>
              </div>
              <textarea value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} placeholder="Mensagem do aviso" rows={4} className="w-full rounded-md border border-neutral-700 bg-[#222] p-3 text-sm text-white" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-neutral-300">Duração:</label><Input type="number" min={1} max={300} value={announcementDuration} onChange={(e) => setAnnouncementDuration(Math.max(1, Math.min(300, Number(e.target.value) || 1)))} className="w-24 bg-[#222] border-neutral-700 text-white" /><span className="text-sm text-neutral-400">segundos</span>
                <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={announcementIsActive} onChange={(e) => setAnnouncementIsActive(e.target.checked)} /> Ativo</label>
                <Button onClick={() => addAnnouncementMutation.mutate({ title: announcementTitle, message: announcementMessage, productType: announcementProductType as any, durationSeconds: announcementDuration, isActive: announcementIsActive })} disabled={addAnnouncementMutation.isPending || !announcementTitle.trim() || !announcementMessage.trim()} className="bg-red-600 hover:bg-red-700">Criar aviso</Button>
              </div>
              <div className="space-y-2">
                {(announcementsList || []).map((announcement: any) => <div key={announcement.id} className="border border-neutral-700 rounded-md bg-[#1b1b1b] p-3"><div className="flex items-center justify-between gap-3"><div><strong>{announcement.title}</strong><span className="ml-2 text-xs text-neutral-400">{announcement.productType === "all" ? "Todos" : announcement.productType} · {announcement.durationSeconds}s</span></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => toggleAnnouncementMutation.mutate({ announcementId: announcement.id, isActive: !announcement.isActive })}>{announcement.isActive ? "Desativar" : "Ativar"}</Button><Button size="sm" variant="destructive" onClick={() => deleteAnnouncementMutation.mutate({ announcementId: announcement.id })}><Trash2 className="h-3 w-3" /></Button></div></div><p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{announcement.message}</p><Badge className={announcement.isActive ? "mt-2 bg-emerald-700" : "mt-2 bg-neutral-700"}>{announcement.isActive ? "Ativo" : "Inativo"}</Badge></div>)}
                {announcementsList?.length === 0 && <p className="text-sm text-neutral-500">Nenhum aviso cadastrado.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVENDEDORES */}
        <TabsContent value="resellers" className="space-y-4">
          <Card className="border-amber-700/50 bg-amber-950/20 text-white"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-white">Prévia: Quero ser revendedor</CardTitle><p className="mt-1 text-xs text-amber-200">Modo desenvolvimento — não aparece para clientes e não processa pagamentos ainda.</p></div><Badge className="border-amber-700 bg-amber-900/40 text-amber-300">DESATIVADO</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{resellerPreviewPlans.map((plan, index) => <div key={plan.name} className="rounded-lg border border-neutral-700 bg-[#171717] p-4"><p className="mb-3 font-bold text-white">{plan.name}</p><div className="grid gap-2 sm:grid-cols-2"><Input value={plan.price} onChange={(e) => setResellerPreviewPlans((current) => current.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} placeholder="Preço (R$)" className="border-neutral-700 bg-[#222] text-white" /><Input type="number" min={0} value={plan.credits} onChange={(e) => setResellerPreviewPlans((current) => current.map((item, i) => i === index ? { ...item, credits: Number(e.target.value) } : item))} placeholder="Créditos iniciais" className="border-neutral-700 bg-[#222] text-white" /></div><p className="mt-3 text-xs text-neutral-400">Após a aprovação, a ideia é liberar usuário, senha, créditos iniciais e Discord opcional.</p></div>)}</div><div className="rounded-lg border border-neutral-800 bg-[#171717] p-4"><p className="mb-3 font-bold text-white">Valor de cada crédito / Key</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[{ type: "advanced", label: "Proxy" }, { type: "ios", label: "Proxy iOS" }, { type: "ios_ipa", label: "Proxy iOS IPA" }, { type: "panel_ios", label: "Painel iOS" }, { type: "panel_android", label: "Painel Android" }, { type: "proxy_android_clientes", label: "Proxy Android Clientes" }].map((item) => <label key={item.type} className="text-xs text-neutral-400">{item.label}<Input value={creditValues[item.type]} onChange={(e) => setCreditValues((current) => ({ ...current, [item.type]: e.target.value }))} className="mt-1 border-neutral-700 bg-[#222] text-white" placeholder="R$ por Key" /></label>)}</div></div><div className="rounded-lg border border-neutral-800 bg-[#171717] p-4"><p className="mb-3 font-bold text-white">Produtos exibidos aos revendedores</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[{ type: "advanced", label: "Proxy" }, { type: "ios", label: "Proxy iOS" }, { type: "ios_ipa", label: "Proxy iOS IPA" }, { type: "panel_ios", label: "Painel iOS" }, { type: "panel_android", label: "Painel Android" }, { type: "proxy_android_clientes", label: "Proxy Android Clientes" }].map((item) => <label key={item.type} className="flex cursor-pointer items-center gap-2 rounded border border-neutral-800 bg-[#202020] p-3 text-sm text-neutral-200"><input type="checkbox" checked={Boolean(resellerVisibleProducts[item.type])} onChange={(e) => setResellerVisibleProducts((current) => ({ ...current, [item.type]: e.target.checked }))} className="h-4 w-4 accent-amber-500" />{item.label}</label>)}</div><p className="mt-2 text-xs text-neutral-500">Marcado = aparece na futura vitrine do revendedor. Desmarcado = fica oculto.</p></div><div className="rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-4"><p className="mb-3 font-bold text-cyan-200">Produtos liberados para compra de créditos</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[{ type: "advanced", label: "Proxy" }, { type: "ios", label: "Proxy iOS" }, { type: "ios_ipa", label: "Proxy iOS IPA" }, { type: "panel_ios", label: "Painel iOS" }, { type: "panel_android", label: "Painel Android" }, { type: "proxy_android_clientes", label: "Proxy Android Clientes" }].map((item) => <label key={item.type} className="flex cursor-pointer items-center gap-2 rounded border border-cyan-900/60 bg-[#102025] p-3 text-sm text-cyan-100"><input type="checkbox" checked={Boolean(resellerCreditProducts[item.type])} onChange={(e) => setResellerCreditProducts((current) => ({ ...current, [item.type]: e.target.checked }))} className="h-4 w-4 accent-cyan-500" />{item.label}</label>)}</div><p className="mt-2 text-xs text-cyan-200/60">Marcado = pode comprar créditos. Esta lista é independente da permissão para gerar logins.</p></div><div className="rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-4"><p className="mb-3 font-bold text-cyan-200">Calculador de créditos</p><div className="grid gap-2 sm:grid-cols-3"><select value={creditCalcType} onChange={(e) => setCreditCalcType(e.target.value)} className="h-10 rounded-md border border-neutral-700 bg-[#222] px-3 text-sm text-white">{[{ value: "advanced", label: "Proxy" }, { value: "ios", label: "Proxy iOS" }, { value: "ios_ipa", label: "Proxy iOS IPA" }, { value: "panel_ios", label: "Painel iOS" }, { value: "panel_android", label: "Painel Android" }, { value: "proxy_android_clientes", label: "Proxy Android Clientes" }].map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}</select><Input type="number" min={1} value={creditCalcQuantity} onChange={(e) => setCreditCalcQuantity(Number(e.target.value))} className="border-neutral-700 bg-[#222] text-white" placeholder="Quantidade" /><div className="flex items-center rounded-md border border-cyan-800 bg-[#0f2228] px-3 text-sm font-bold text-cyan-200">Total: R$ {(Number((creditValues[creditCalcType] || "0").replace(",", ".")) * creditCalcQuantity).toFixed(2).replace(".", ",")}</div></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-amber-700 bg-transparent text-amber-300" onClick={() => { resellerPreviewPlans.forEach((plan: any) => saveResellerPlan.mutate({ id: plan.id, name: plan.name, price: Number(String(plan.price).replace(",", ".")), initialCredits: plan.credits, isPremium: Boolean(plan.isPremium), isActive: true })); saveResellerConfig.mutate({ creditValues, visibleProducts: resellerVisibleProducts, creditProducts: resellerCreditProducts }); }}>Salvar preços e configurações</Button><Button disabled className="bg-neutral-700 text-neutral-400">Comprar plano (em breve)</Button></div><div className="rounded-md border border-neutral-800 bg-[#101010] p-3 text-xs text-neutral-400"><strong className="text-white">Fluxo planejado:</strong> cliente escolhe um plano, informa usuário, senha e Discord opcional; após o pagamento aprovado, o sistema cria o revendedor, lança os créditos automaticamente e mostra o painel com tabela de créditos. O moderador continuará podendo alterar preços, créditos, produtos, Discord e status na gestão abaixo.</div></CardContent></Card>
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
                  <label className="text-xs text-white font-semibold block mb-1">Nome exibido para os clientes (opcional)</label>
                  <Input className="bg-[#222] border-neutral-700 text-white" value={newResellerBrandName} onChange={(e) => setNewResellerBrandName(e.target.value)} placeholder="Ex.: Painel do João" />
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Discord dos clientes (opcional)</label>
                  <Input className="bg-[#222] border-neutral-700 text-white" value={newResellerDiscordUrl} onChange={(e) => setNewResellerDiscordUrl(e.target.value)} placeholder="https://discord.gg/exemplo" />
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Cor da marca</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={newResellerColor} onChange={(e) => setNewResellerColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-neutral-700 bg-[#222] p-1" aria-label="Escolher cor da marca" />
                    <span className="text-xs font-mono text-neutral-300">{newResellerColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Créditos Advanced</label>
                  <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsAdvanced} onChange={(e) => setNewResellerCreditsAdvanced(Number(e.target.value))} />
                </div>
                  <div>
                    <label className="text-xs text-white font-semibold block mb-1">Créditos Painel iOS</label>
                    <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsPanelIos} onChange={(e) => setNewResellerCreditsPanelIos(Number(e.target.value))} />
                  </div>
                                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Créditos Proxy Android Clientes</label>
                  <Input type="number" className="bg-[#222] border-neutral-700 text-white" value={newResellerCreditsProxyAndroidClientes} onChange={(e) => setNewResellerCreditsProxyAndroidClientes(Number(e.target.value))} />
                </div>
                  <div className="flex items-center space-x-2 pt-2">

                  <input type="checkbox" id="isPremiumCheck" className="w-4 h-4 rounded border-neutral-700 bg-[#222] text-red-600 focus:ring-red-500" checked={newResellerIsPremium} onChange={(e) => setNewResellerIsPremium(e.target.checked)} />
                  <label htmlFor="isPremiumCheck" className="text-xs font-bold text-amber-400 cursor-pointer">Revendedor Premium (★)</label>
                </div>
                <Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto" onClick={() => createResellerMutation.mutate({ username: newResellerUser, password: newResellerPass, resellerDisplayName: newResellerBrandName, resellerDiscordUrl: newResellerDiscordUrl, resellerColor: newResellerColor, creditsBasic: newResellerCreditsBasic, creditsAdvanced: newResellerCreditsAdvanced, creditsIos: newResellerCreditsIos, creditsPanelIos: newResellerCreditsPanelIos, creditsPanelLegitimo: newResellerCreditsPanelLegitimo, creditsProxyAndroidClientes: newResellerCreditsProxyAndroidClientes, isPremium: newResellerIsPremium })}>
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
                          { name: 'advanced', label: 'Android Advanced', color: 'text-amber-400' },
                                          { name: 'panel_ios', label: 'Painel iOS', color: 'text-cyan-400' },
                          { name: 'panel_android', label: 'Painel Android', color: 'text-orange-400' },
          { name: 'proxy_android_clientes', label: 'Proxy Android Clientes', color: 'text-lime-400' },
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
                        <Button size="sm" variant="outline" className="border-emerald-700 text-emerald-300 bg-emerald-950/30" title="Colar o link público do banner para clientes deste revendedor" disabled={setResellerBannerUrlMutation.isPending} onClick={() => {
                          const bannerUrl = prompt(`Link público HTTPS do banner para clientes criados por ${r.username}. Deixe vazio para remover:`, r.resellerBannerUrl || "");
                          if (bannerUrl === null) return;
                          setResellerBannerUrlMutation.mutate({ resellerId: r.id, bannerUrl });
                        }}>
                          {setResellerBannerUrlMutation.isPending ? "Salvando..." : r.resellerBannerUrl ? "Banner ✓" : "Banner"}
                        </Button>
                        <Button size="sm" variant="outline" className="border-fuchsia-700 text-fuchsia-300 bg-fuchsia-950/30" title="Colar link HTTPS do vídeo do banner para clientes deste revendedor" disabled={setResellerBannerVideoUrlMutation.isPending} onClick={() => {
                          const videoUrl = prompt(`Link HTTPS do vídeo do banner para clientes criados por ${r.username}. Aceita link direto .mp4/.webm ou página pública do MediaFire. Deixe vazio para remover:`, r.resellerBannerVideoUrl || "");
                          if (videoUrl === null) return;
                          setResellerBannerVideoUrlMutation.mutate({ resellerId: r.id, videoUrl });
                        }}>
                          {setResellerBannerVideoUrlMutation.isPending ? "Salvando..." : r.resellerBannerVideoUrl ? "Vídeo ✓" : "Vídeo"}
                        </Button>
                        <Button size="sm" variant="outline" className="border-cyan-700 text-cyan-300 bg-cyan-950/30" title="Personalizar nome e Discord dos clientes deste revendedor" onClick={() => {
                          const displayName = prompt(`Nome exibido para clientes criados por ${r.username}. Deixe vazio para usar o padrão:`, r.resellerDisplayName || "");
                          if (displayName === null) return;
                          const discordUrl = prompt(`Link do Discord para clientes criados por ${r.username}. Deixe vazio para usar o padrão:`, r.resellerDiscordUrl || "");
                          if (discordUrl === null) return;
                          const color = prompt(`Cor da marca em hexadecimal para ${r.username} (ex.: #22c55e):`, r.resellerColor || "#dc2626");
                          if (color === null) return;
                          updateResellerBrandingMutation.mutate({ resellerId: r.id, displayName, discordUrl, color });
                        }}>Marca</Button>
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
                  <div>Link de ativação: <strong className="text-blue-400">https://shelbys-production.up.railway.app</strong></div>
                </div>
                <Button className="bg-red-600 hover:bg-red-700 text-white mt-2" onClick={() => {
                  navigator.clipboard.writeText(`Usuário: ${modCreatedCredentials.username}\nSenha: ${modCreatedCredentials.password}\nLink de ativação: https://shelbys-production.up.railway.app`);
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
                        <option value="advanced">Android Advanced</option>
                        <option value="panel_ios">Painel iOS</option>
                        <option value="panel_android">Painel Android</option>
                    <option value="proxy_android_clientes">Proxy Android Clientes</option>
                    <option value="ios_ipa">Proxy iOS IPA</option>
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
                        <option value="advanced">Android Advanced</option>
                        <option value="panel_ios">Painel iOS</option>
                    <option value="panel_android">Painel Android</option>
                    <option value="proxy_android_clientes">Proxy Android Clientes</option>
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
          <Card className="bg-[#141414] border-lime-800 text-white">
            <CardHeader><CardTitle className="text-white">Gerar vários logins — Moderador</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-neutral-400">Informe a quantidade desejada. Cada login terá usuário com 4 letras, senha com 4 números e o link do site.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Produto</label>
                  <select className="w-48 bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={modClientType} onChange={(e: any) => setModClientType(e.target.value)}>
                    <option value="advanced">Android Advanced</option>
                    <option value="panel_ios">Painel iOS</option>
                    <option value="panel_android">Painel Android</option>
                    <option value="proxy_android_clientes">Proxy Android Clientes</option>
                    <option value="ios_ipa">Proxy iOS IPA</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white font-semibold block mb-1">Quantidade</label>
                  <Input type="number" min={1} step={1} className="w-32 bg-[#222] border-neutral-700 text-white" value={modBulkQuantity} onChange={(e) => setModBulkQuantity(Number(e.target.value))} placeholder="Quantidade" />
                </div>
                <Button className="bg-lime-600 hover:bg-lime-500 text-black font-bold" onClick={handleModeratorBulkGenerate} disabled={modBulkGenerating || modCreateClientMutation.isPending}>
                  {modBulkGenerating ? "Gerando..." : "Gerar logins"}
                </Button>
              </div>
              {modBulkCredentials.length > 0 && <div className="space-y-2 rounded border border-neutral-700 bg-black/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-lime-300">Logins gerados</p><Button size="sm" variant="outline" className="border-lime-700 text-lime-300" onClick={() => { navigator.clipboard.writeText(modBulkCredentials.map((credential) => `Usuário: ${credential.username}\nSenha: ${credential.password}\nLink de ativação: https://shelbys-production.up.railway.app`).join("\n\n")); toast.success("Todos os logins foram copiados!"); }}><Copy className="w-3 h-3 mr-1" /> Copiar todos</Button></div>
                <div className="max-h-72 overflow-y-auto space-y-2">{modBulkCredentials.map((credential) => <div key={`${credential.username}-${credential.password}`} className="rounded border border-neutral-800 bg-[#1b1b1b] p-2 font-mono text-xs"><div>Usuário: <strong className="text-white">{credential.username}</strong></div><div>Senha: <strong className="text-white">{credential.password}</strong></div><div>Link: <span className="text-blue-400">https://shelbys-production.up.railway.app</span></div><Button size="sm" variant="outline" className="mt-2 border-neutral-700 text-neutral-200" onClick={() => { navigator.clipboard.writeText(`Usuário: ${credential.username}\nSenha: ${credential.password}\nLink de ativação: https://shelbys-production.up.railway.app`); toast.success("Login copiado!"); }}><Copy className="w-3 h-3 mr-1" /> Copiar</Button></div>)}</div>
              </div>}
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-neutral-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Todos os Clientes do Sistema</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <select className="bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={modLoginFilter} onChange={(e) => setModLoginFilter(e.target.value as "all" | "logged" | "never")}>
                  <option value="all">Todos os logins</option>
                  <option value="logged">Já entrou</option>
                  <option value="never">Ainda não entrou</option>
                </select>
                <Input
                  className="w-56 bg-[#222] border-neutral-700 text-white text-sm"
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
                    <TableHead className="text-white font-bold">Acesso</TableHead>
                    <TableHead className="text-white font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients
                    ?.filter((c) => c.username.toLowerCase().includes(modClientSearch.toLowerCase()))
                    ?.filter((c) => modLoginFilter === "all" || (modLoginFilter === "logged" ? c.hasLoggedIn : !c.hasLoggedIn))
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
                      <TableCell>{c.hasLoggedIn ? <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800">Já entrou{c.lastLoginAt ? ` · ${new Date(c.lastLoginAt).toLocaleString()}` : ""}</Badge> : <Badge className="bg-amber-950 text-amber-300 border-amber-800">Ainda não entrou</Badge>}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => { setModRenewType((c.keyType === "ios_basic" || c.keyType === "ios_advanced" ? "ios" : c.keyType || "advanced") as any); setModRenewingClient({ id: c.id, username: c.username }); }}>
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
          <Card className="bg-violet-950/30 border-violet-800 text-white"><CardHeader><CardTitle className="text-white">Administração do Proxy iOS IPA</CardTitle></CardHeader><CardContent><p className="text-sm text-violet-100">Créditos e Keys independentes para o Proxy iOS IPA. Novos clientes recebem a última Key IPA ativa.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Créditos Proxy iOS IPA por revendedor</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Créditos IPA</TableHead><TableHead className="text-white font-bold text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{resellers?.map((r: any) => <TableRow key={r.id} className="border-neutral-800"><TableCell className="font-bold text-white">{r.username}</TableCell><TableCell className="text-violet-400 font-black">{r.credits?.ios_ipa || 0}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="border-violet-700 bg-violet-950/40 text-violet-300" onClick={() => { const action = prompt(`Para ${r.username}, digite add ou remove:`); if (action === "add" || action === "remove") { const amount = Number(prompt("Quantidade de créditos IPA:")); if (Number.isInteger(amount) && amount > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "ios_ipa", action, amount }); } }}>Adicionar/Remover</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Keys Proxy iOS IPA</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Cole a Key IPA" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} /><Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: "ios_ipa" })}>Adicionar Key IPA</Button><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Uma Key IPA por linha" value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} /><Button className="w-full bg-violet-800 hover:bg-violet-900 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: "ios_ipa" })}>Importar Keys IPA</Button></CardContent></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Download Proxy iOS IPA</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Descrição" value={dlDesc} onChange={(e) => setDlDesc(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={dlVersion} onChange={(e) => setDlVersion(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do arquivo" value={dlUrl} onChange={(e) => setDlUrl(e.target.value)} /><Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: "ios_ipa" })}>Cadastrar Download IPA</Button></CardContent></Card>
            <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Tutorial Proxy iOS IPA</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Descrição" value={tutDesc} onChange={(e) => setTutDesc(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do vídeo ou MediaFire" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} /><Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: "ios_ipa" })}>Cadastrar Tutorial IPA</Button></CardContent></Card>
          </div>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Conteúdo Proxy iOS IPA cadastrado</CardTitle></CardHeader><CardContent className="space-y-4"><div><h4 className="text-sm font-bold text-violet-400 mb-2">Downloads</h4>{downloadsList?.filter((d: any) => d.type === "ios_ipa").map((d: any) => <div key={d.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm"><span>{d.title} — v{d.version}</span><Button size="sm" variant="destructive" onClick={() => deleteDownloadMutation.mutate({ downloadId: d.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div><div><h4 className="text-sm font-bold text-violet-400 mb-2">Tutoriais</h4>{tutorialsList?.filter((t: any) => t.type === "ios_ipa").map((t: any) => <div key={t.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm"><span>{t.title}</span><Button size="sm" variant="destructive" onClick={() => deleteTutorialMutation.mutate({ tutorialId: t.id })}><Trash2 className="w-3 h-3" /></Button></div>)}</div></CardContent></Card>
        </TabsContent>
        <TabsContent value="iosIpaKeys" className="space-y-4">
          <Card className="bg-violet-950/30 border-violet-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-white">Gerenciar Keys Proxy iOS IPA</CardTitle><p className="text-sm text-violet-100 mt-1">Cada cliente IPA recebe uma Key exclusiva. Você pode ativar, desativar, excluir e exportar as Keys.</p></div>
              <Button size="sm" className="bg-neutral-800 hover:bg-neutral-700 text-white" onClick={() => { const text = keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "ios_ipa").map(k => k.keyValue).join("\n") || ""; const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "keys_ios_ipa.txt"; a.click(); URL.revokeObjectURL(url); }}>Exportar IPA (.txt)</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center mb-4"><div className="rounded border border-emerald-800 bg-emerald-950/30 p-2"><div className="text-xs text-neutral-300">Disponíveis</div><strong className="text-emerald-400 text-lg">{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "ios_ipa" && k.isActive && !k.isUsed && !k.isBanned).length || 0}</strong></div><div className="rounded border border-amber-800 bg-amber-950/30 p-2"><div className="text-xs text-neutral-300">Usadas</div><strong className="text-amber-400 text-lg">{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "ios_ipa" && k.isUsed).length || 0}</strong></div><div className="rounded border border-red-800 bg-red-950/30 p-2"><div className="text-xs text-neutral-300">Banidas</div><strong className="text-red-400 text-lg">{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "ios_ipa" && k.isBanned).length || 0}</strong></div></div>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">ID</TableHead><TableHead className="text-white font-bold">Key</TableHead><TableHead className="text-white font-bold">Status</TableHead><TableHead className="text-white font-bold text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "ios_ipa").map(k => <TableRow key={k.id} className="border-neutral-800"><TableCell className="font-mono text-white">#{k.id}</TableCell><TableCell className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</TableCell><TableCell><Badge className={k.isBanned ? "bg-red-950 text-red-400 border-red-800" : k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : k.isActive ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-neutral-800 text-neutral-300 border-neutral-700"}>{k.isBanned ? "Banida" : k.isUsed ? "Usada" : k.isActive ? "Disponível" : "Desativada"}</Badge></TableCell><TableCell className="text-right space-x-1"><Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800" onClick={() => toggleKeyMutation.mutate({ keyId: k.id })}><Power className="w-3 h-3" /></Button><Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}><Trash2 className="w-3 h-3" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAINEL ANDROID */}
        <TabsContent value="androidPanel" className="space-y-4">
          <Card className="bg-orange-950/30 border-orange-800 text-white"><CardHeader><CardTitle className="text-white">Administração completa do Painel Android</CardTitle></CardHeader><CardContent><p className="text-sm text-orange-100">Este painel usa o tipo <strong>panel_android</strong>, com créditos, Keys e conteúdos separados.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Créditos do Painel Android por revendedor</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Créditos Painel Android</TableHead><TableHead className="text-white font-bold text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{resellers?.map((r: any) => <TableRow key={r.id} className="border-neutral-800"><TableCell className="font-bold text-white">{r.username}</TableCell><TableCell className="text-orange-400 font-black">{r.credits?.panel_android || 0}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="border-orange-700 bg-orange-950/40 text-orange-300" onClick={() => { const action = prompt(`Para ${r.username}, digite add ou remove:`); if (action === "add" || action === "remove") { const amount = Number(prompt("Quantidade de créditos Painel Android:")); if (Number.isInteger(amount) && amount > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "panel_android", action, amount }); } }}>Adicionar/Remover créditos</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Keys do Painel Android</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Cole a Key do Painel Android" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} /><Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: "panel_android" })}>Adicionar Key Painel Android</Button><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Uma Key por linha" value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} /><Button className="w-full bg-orange-800 hover:bg-orange-900 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: "panel_android" })}>Importar Keys Painel Android</Button></CardContent></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Download Painel Android</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={dlVersion} onChange={(e) => setDlVersion(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="URL do download" value={dlUrl} onChange={(e) => setDlUrl(e.target.value)} /><Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: "panel_android" })}>Cadastrar Download</Button></CardContent></Card><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Tutorial Painel Android</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do tutorial" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} /><Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: "panel_android" })}>Cadastrar Tutorial</Button></CardContent></Card></div>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Conteúdo Painel Android cadastrado</CardTitle></CardHeader><CardContent><p className="text-sm text-neutral-300">Downloads: {downloadsList?.filter((d: any) => d.type === "panel_android").length || 0} · Tutoriais: {tutorialsList?.filter((t: any) => t.type === "panel_android").length || 0}</p></CardContent></Card>
        </TabsContent>


        {/* PROXY ANDROID CLIENTES */}
        <TabsContent value="proxyAndroidClientesPanel" className="space-y-4">
          <Card className="bg-lime-950/30 border-lime-800 text-white"><CardHeader><CardTitle className="text-white">Administração completa do Proxy Android Clientes</CardTitle></CardHeader><CardContent><p className="text-sm text-lime-100">Este painel usa o tipo <strong>proxy_android_clientes</strong>, com créditos, Keys e conteúdos separados.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Créditos do Proxy Android Clientes por revendedor</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Revendedor</TableHead><TableHead className="text-white font-bold">Créditos Proxy Android Clientes</TableHead><TableHead className="text-white font-bold text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{resellers?.map((r: any) => <TableRow key={r.id} className="border-neutral-800"><TableCell className="font-bold text-white">{r.username}</TableCell><TableCell className="text-lime-400 font-black">{r.credits?.proxy_android_clientes || 0}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="border-lime-700 bg-lime-950/40 text-lime-300" onClick={() => { const action = prompt(`Para ${r.username}, digite add ou remove:`); if (action === "add" || action === "remove") { const amount = Number(prompt("Quantidade de créditos Proxy Android Clientes:")); if (Number.isInteger(amount) && amount > 0) updateCreditsMutation.mutate({ resellerId: r.id, type: "proxy_android_clientes", action, amount }); } }}>Adicionar/Remover créditos</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Cadastrar Keys do Proxy Android Clientes</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white font-mono" placeholder="Cole a Key do Proxy Android Clientes" value={newKeyVal} onChange={(e) => setNewKeyVal(e.target.value)} /><Button className="w-full bg-lime-600 hover:bg-lime-700 text-white" onClick={() => addKeyMutation.mutate({ keyValue: newKeyVal, type: "proxy_android_clientes" })}>Adicionar Key Proxy Android Clientes</Button><textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Uma Key por linha" value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} /><Button className="w-full bg-lime-800 hover:bg-lime-900 text-white" onClick={() => batchAddKeysMutation.mutate({ keysList: batchKeysText.split("\n"), type: "proxy_android_clientes" })}>Importar Keys Proxy Android Clientes</Button></CardContent></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Download Proxy Android Clientes</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Versão" value={dlVersion} onChange={(e) => setDlVersion(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="URL do download" value={dlUrl} onChange={(e) => setDlUrl(e.target.value)} /><Button className="w-full bg-lime-600 hover:bg-lime-700 text-white" onClick={() => addDownloadMutation.mutate({ title: dlTitle, description: dlDesc, version: dlVersion, fileUrl: dlUrl, type: "proxy_android_clientes" })}>Cadastrar Download</Button></CardContent></Card><Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Tutorial Proxy Android Clientes</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Título" value={tutTitle} onChange={(e) => setTutTitle(e.target.value)} /><Input className="bg-[#222] border-neutral-700 text-white" placeholder="Link do tutorial" value={tutUrl} onChange={(e) => setTutUrl(e.target.value)} /><Button className="w-full bg-lime-600 hover:bg-lime-700 text-white" onClick={() => addTutorialMutation.mutate({ title: tutTitle, description: tutDesc, videoUrl: tutUrl, type: "proxy_android_clientes" })}>Cadastrar Tutorial</Button></CardContent></Card></div>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader><CardTitle className="text-white">Conteúdo Proxy Android Clientes cadastrado</CardTitle></CardHeader><CardContent><p className="text-sm text-neutral-300">Downloads: {downloadsList?.filter((d: any) => d.type === "proxy_android_clientes").length || 0} · Tutoriais: {tutorialsList?.filter((t: any) => t.type === "proxy_android_clientes").length || 0}</p></CardContent></Card>
        </TabsContent>

        {/* KEYS PAINEL ANDROID */}
        <TabsContent value="androidKeys" className="space-y-4">
          <Card className="bg-orange-950/30 border-orange-800 text-white"><CardHeader><CardTitle className="text-white">Keys do Painel Android</CardTitle></CardHeader><CardContent><p className="text-sm text-orange-100">Disponíveis: <strong>{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_android" && !k.isUsed && !k.isBanned).length || 0}</strong> · Usadas: <strong>{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_android" && (k.isUsed || k.isBanned)).length || 0}</strong></p><div className="mt-3 max-h-80 overflow-y-auto space-y-1">{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_android").map(k => <div key={k.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-xs"><span className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</span><div className="flex items-center gap-2"><Badge className={k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-emerald-950 text-emerald-400 border-emerald-800"}>{k.isUsed ? "Usada" : "Disponível"}</Badge><Button size="sm" variant="destructive" title="Excluir Key do Painel Android" onClick={() => { if (confirm(`Excluir a Key ${k.keyValue}? O login existente continuará salvo, mas esta Key será removida da lista.`)) deleteAndroidKeyMutation.mutate({ keyId: k.id }); }}><Trash2 className="w-3 h-3" /></Button></div></div>)}</div></CardContent></Card>
        </TabsContent>
        {/* PAINEL LEGÍTIMO */}

        <TabsContent value="proxyAndroidClientesKeys" className="space-y-4">
          <Card className="bg-lime-950/30 border-lime-800 text-white"><CardHeader><CardTitle className="text-white">Keys do Proxy Android Clientes</CardTitle></CardHeader><CardContent><p className="text-sm text-lime-100">Disponíveis: <strong>{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "proxy_android_clientes" && !k.isUsed && !k.isBanned).length || 0}</strong> · Usadas: <strong>{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "proxy_android_clientes" && (k.isUsed || k.isBanned)).length || 0}</strong></p>{(keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "proxy_android_clientes" && !k.isUsed && !k.isBanned).length || 0) <= 5 && <p className="mt-2 rounded border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-300">Aviso: o estoque de Keys do Proxy Android Clientes está acabando.</p>}<div className="mt-3 max-h-80 overflow-y-auto space-y-1">{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "proxy_android_clientes").map(k => <div key={k.id} className="flex items-center justify-between border-b border-neutral-800 py-2 text-xs"><span className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</span><div className="flex items-center gap-2"><Badge className={k.isUsed ? "bg-amber-950 text-amber-400 border-amber-800" : "bg-emerald-950 text-emerald-400 border-emerald-800"}>{k.isUsed ? "Usada" : "Disponível"}</Badge><Button size="sm" variant="destructive" title="Excluir Key do Proxy Android Clientes" onClick={() => { if (confirm(`Excluir a Key ${k.keyValue}? O login existente continuará salvo, mas esta Key será removida da lista.`)) deleteAndroidKeyMutation.mutate({ keyId: k.id }); }}><Trash2 className="w-3 h-3" /></Button></div></div>)}</div></CardContent></Card>
        </TabsContent>
        {/* PAINEL LEGÍTIMO */}
        <TabsContent value="keys" className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-2 bg-[#141414] border border-neutral-800 p-4 rounded-lg">
            <div>
              <h3 className="text-sm font-bold text-white">Segurança e Gestão de Chaves</h3>
              <p className="text-xs text-neutral-400">As chaves aparecem mascaradas por padrão. Você também pode remover todas as chaves expiradas (&gt;24h de uso).</p><Input value={keyGlobalSearch} onChange={(e) => setKeyGlobalSearch(e.target.value)} placeholder="Pesquisar Key, tipo, ID ou status" className="mt-3 w-full border-neutral-700 bg-[#222] text-white sm:max-w-md" />
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
                        <option value="advanced">Android Advanced</option>
                        <option value="panel_ios">Painel iOS</option>
                    <option value="panel_android">Painel Android</option>
                    <option value="proxy_android_clientes">Proxy Android Clientes</option>
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
                        <option value="advanced">Android Advanced</option>
                        <option value="panel_ios">Painel iOS</option>
                    <option value="panel_android">Painel Android</option>
                    <option value="proxy_android_clientes">Proxy Android Clientes</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
                  </select>
                </div>
                <textarea className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-xs font-mono h-24" placeholder="Cole uma key por linha..." value={batchKeysText} onChange={(e) => setBatchKeysText(e.target.value)} />
                <label className="block rounded-md border border-dashed border-neutral-700 bg-[#1b1b1b] p-3 text-xs text-neutral-300 cursor-pointer hover:border-red-500 transition-colors">
                  <span className="font-semibold text-white">Ou escolha um arquivo .txt</span>
                  <input type="file" accept=".txt,text/plain" className="mt-2 block w-full text-xs text-neutral-400 file:mr-3 file:rounded file:border-0 file:bg-neutral-700 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-neutral-600" onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (!file) return;
                    file.text().then(setBatchKeysText).catch(() => toast.error("Não foi possível ler o arquivo .txt."));
                    e.currentTarget.value = "";
                  }} />
                </label>
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
                    {keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "advanced" && !k.isBanned && !k.isUsed).map((k) => (
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

          <Card className="bg-[#141414] border-blue-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-white">Keys - Painel iOS</CardTitle><p className="text-xs text-neutral-400 mt-1">Controle separado das Keys disponíveis e já usadas pelo Painel iOS.</p></div>
              <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-white" onClick={() => {
                const available = (keysList || []).filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_ios" && !k.isUsed && !k.isBanned).map(k => k.keyValue).join("\\n");
                const used = (keysList || []).filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_ios" && (k.isUsed || k.isBanned)).map(k => k.keyValue).join("\\n");
                const text = `PAINEL IOS - DISPONIVEIS\\n${available}\\n\\nPAINEL IOS - USADAS\\n${used}`;
                const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "keys_painel_ios.txt"; a.click(); URL.revokeObjectURL(url);
              }}>Exportar Painel iOS</Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Card className="bg-emerald-950/30 border-emerald-800"><CardContent className="p-4"><p className="text-xs text-emerald-300 uppercase font-bold">Disponíveis</p><p className="text-2xl text-emerald-400 font-black">{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_ios" && !k.isUsed && !k.isBanned).length || 0}</p></CardContent></Card><Card className="bg-amber-950/30 border-amber-800"><CardContent className="p-4"><p className="text-xs text-amber-300 uppercase font-bold">Já usadas</p><p className="text-2xl text-amber-400 font-black">{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_ios" && (k.isUsed || k.isBanned)).length || 0}</p></CardContent></Card></div>
              <div><h4 className="text-sm text-emerald-400 font-bold mb-2">Keys disponíveis</h4><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white">ID</TableHead><TableHead className="text-white">Key</TableHead><TableHead className="text-white">Estado</TableHead><TableHead className="text-white text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_ios" && !k.isUsed && !k.isBanned).map(k => <TableRow key={k.id} className="border-neutral-800"><TableCell>#{k.id}</TableCell><TableCell className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</TableCell><TableCell><Badge className="bg-emerald-950 text-emerald-400 border-emerald-800">Disponível</Badge></TableCell><TableCell className="text-right space-x-1"><Button size="sm" variant="outline" className="border-neutral-700 bg-transparent text-white" onClick={() => toggleKeyMutation.mutate({ keyId: k.id })}><Power className="w-3 h-3" /></Button><Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}><Trash2 className="w-3 h-3" /></Button></TableCell></TableRow>)}</TableBody></Table></div></div>
              <div><h4 className="text-sm text-amber-400 font-bold mb-2">Keys já usadas</h4><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white">ID</TableHead><TableHead className="text-white">Key</TableHead><TableHead className="text-white">Estado</TableHead><TableHead className="text-white">Usada em</TableHead><TableHead className="text-white text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{keysList?.filter(k => keyMatches(k, keyGlobalSearch) && k.type === "panel_ios" && (k.isUsed || k.isBanned)).map(k => <TableRow key={k.id} className="border-neutral-800"><TableCell>#{k.id}</TableCell><TableCell className="font-mono text-cyan-300">{keysRevealed ? k.keyValue : "••••••••••••"}</TableCell><TableCell><Badge className="bg-amber-950 text-amber-400 border-amber-800">Usada</Badge></TableCell><TableCell className="text-xs text-neutral-400">{k.usedAt ? new Date(k.usedAt).toLocaleString() : "—"}</TableCell><TableCell className="text-right"><Button size="sm" variant="destructive" onClick={() => deleteKeyMutation.mutate({ keyId: k.id })}><Trash2 className="w-3 h-3" /></Button></TableCell></TableRow>)}</TableBody></Table></div></div>
            </CardContent>
            </Card>
          </div>
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
                  {keysList?.filter(k => keyMatches(k, keyGlobalSearch) && (k.isBanned || (k.isUsed && k.type !== 'ios'))).map((k) => (
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
                  {(!keysList || keysList.filter(k => keyMatches(k, keyGlobalSearch) && (k.isBanned || (k.isUsed && k.type !== 'ios'))).length === 0) && (
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
                  <option value="advanced">Proxy Advanced</option>
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
                  <option value="advanced">Proxy Advanced</option>
                    <option value="panel_ios">Painel iOS</option>
                    <option value="panel_android">Painel Android</option>
                    <option value="proxy_android_clientes">Proxy Android Clientes</option>
                  <option value="ios_ipa">Proxy iOS IPA</option>
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
                    <TableHead className="text-white font-bold">Tipo / Produto</TableHead>
                    <TableHead className="text-white font-bold">Link</TableHead>
                    <TableHead className="text-white font-bold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tutorialsList?.map((t) => (
                    <TableRow key={t.id} className="border-neutral-800">
                      <TableCell className="font-bold text-white">{t.title}</TableCell>
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
                        <option value="advanced">Proxy Advanced</option>
                    <option value="panel_ios">Painel iOS</option>
                    <option value="panel_android">Painel Android</option>
                    <option value="proxy_android_clientes">Proxy Android Clientes</option>
                <option value="ios_ipa">Proxy iOS IPA</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {[
                  { type: "all", label: "Total" },
                  { type: "advanced", label: "Proxy Advanced" },
                  { type: "panel_ios", label: "Painel iOS" },
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
  const { activeSection, setActiveSection, setMenuItems } = useManagementNavigation();
  const { data, refetch } = trpc.reseller.dashboard.useQuery();
  const [creditPix, setCreditPix] = useState<any>(null);
  const [creditType, setCreditType] = useState("advanced");
  const [creditQuantity, setCreditQuantity] = useState(1);
  const creditCheckout = trpc.store.createCreditCheckout.useMutation({ onSuccess: setCreditPix, onError: (e) => toast.error(e.message) });
  const cancelCredit = trpc.store.cancelCreditOrder.useMutation({ onSuccess: () => { toast.success("Compra de créditos cancelada."); setCreditPix(null); }, onError: (e) => toast.error(e.message) });
  const creditStatus = trpc.store.creditPaymentStatus.useQuery({ orderId: creditPix?.orderId || 0 }, { enabled: Boolean(creditPix?.orderId), refetchInterval: creditPix?.orderId ? 5000 : false });
  useEffect(() => { if (creditStatus.data?.approved) { toast.success("Créditos adicionados ao seu saldo."); refetch(); } }, [creditStatus.data?.approved]);
  const { data: subResellers, refetch: refetchSubResellers } = trpc.moderator.listResellers.useQuery(undefined, {
    enabled: !!data?.isPremium
  });

  const [newClientUser, setNewClientUser] = useState("");
  const [newClientPass, setNewClientPass] = useState("");
  const [newClientType, setNewClientType] = useState<ActiveProductType>("advanced");
  const [newClientMaxDevices, setNewClientMaxDevices] = useState(1);
  const [clientSearch, setClientSearch] = useState("");
  const [renewingClient, setRenewingClient] = useState<{ id: number; username: string } | null>(null);
  const [renewType, setRenewType] = useState<any>("advanced");
  const [iosClientSearch, setIosClientSearch] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const allResellerProducts = [...ACTIVE_PRODUCT_TYPES];
  const enabledResellerProducts = data?.enabledProducts || allResellerProducts;
  const canUseProduct = (type: string) => enabledResellerProducts.includes(type);
  const resellerProductOptions = [
    { value: "advanced", label: "Proxy" }, { value: "ios", label: "Proxy iOS" }, { value: "ios_ipa", label: "Proxy iOS IPA" }, { value: "panel_ios", label: "Painel iOS" }, { value: "panel_android", label: "Painel Android" }, { value: "proxy_android_clientes", label: "Proxy Android Clientes" },
  ].filter((product) => canUseProduct(product.value));
  const creditProductOptions = [
    { value: "advanced", label: "Proxy" }, { value: "ios", label: "Proxy iOS" }, { value: "ios_ipa", label: "Proxy iOS IPA" }, { value: "panel_ios", label: "Painel iOS" }, { value: "panel_android", label: "Painel Android" }, { value: "proxy_android_clientes", label: "Proxy Android Clientes" },
  ].filter((product) => (data?.creditProducts || [...ACTIVE_PRODUCT_TYPES]).includes(product.value as ActiveProductType));
  useEffect(() => {
    if (creditProductOptions.length && !creditProductOptions.some((product) => product.value === creditType)) setCreditType(creditProductOptions[0].value);
    if (resellerProductOptions.length && !resellerProductOptions.some((product) => product.value === newClientType)) setNewClientType(resellerProductOptions[0].value as ActiveProductType);
    const allowedProductTypes = new Set(enabledResellerProducts);
    const visibleItems = resellerNavigationItems.filter((item) => {
      if (item.value === "clients") return true;
      if (item.value === "subresellers") return Boolean(data?.isPremium);
      if (item.value === "androidPanel") return allowedProductTypes.has("panel_android");
      if (item.value === "proxyAndroidClientesPanel") return allowedProductTypes.has("proxy_android_clientes");
      if (item.value === "iosIpaPanel") return allowedProductTypes.has("ios_ipa");
      return false;
    });
    setMenuItems(visibleItems);
    if (!visibleItems.some((item) => item.value === activeSection)) setActiveSection("clients");
  }, [activeSection, data?.isPremium, enabledResellerProducts.join(","), setActiveSection, setMenuItems]);
  const normalizeRenewalType = (type: string | null | undefined) => {
    const normalized = type === "ios_basic" || type === "ios_advanced" ? "ios" : type;
    return resellerProductOptions.some((product) => product.value === normalized) ? normalized : (resellerProductOptions[0]?.value || "advanced");
  };

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
          { name: 'advanced', label: 'Android Advanced', color: 'text-amber-400' },
          { name: 'panel_ios', label: 'Painel iOS', color: 'text-cyan-400' },
          { name: 'panel_android', label: 'Painel Android', color: 'text-orange-400' },
          { name: 'proxy_android_clientes', label: 'Proxy Android Clientes', color: 'text-lime-400' },
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

      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
                  <TabsList className="sr-only">
          <TabsTrigger value="clients" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Seus Clientes</TabsTrigger>
          {canUseProduct("panel_android") && <TabsTrigger value="androidPanel" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white">Painel Android</TabsTrigger>}
          {canUseProduct("proxy_android_clientes") && <TabsTrigger value="proxyAndroidClientesPanel" className="data-[state=active]:bg-lime-600 data-[state=active]:text-white text-white">Proxy Android Clientes</TabsTrigger>}
          {canUseProduct("ios_ipa") && <TabsTrigger value="iosIpaPanel" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white">Proxy iOS IPA</TabsTrigger>}
          {data?.isPremium && (
            <TabsTrigger value="subresellers" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">Seus Revendedores</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="clients" className="space-y-4">

      <Card className="border-emerald-800 bg-emerald-950/20 text-white"><CardHeader><CardTitle className="text-white">Seus créditos</CardTitle></CardHeader><CardContent><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(data?.credits || {}).filter(([type]) => type !== "basic" && type !== "panel_legitimo").map(([type, amount]) => <div key={type} className="rounded border border-neutral-800 bg-[#171717] p-2"><p className="text-[10px] uppercase text-neutral-400">{type}</p><p className="text-xl font-black text-emerald-400">{amount as number}</p></div>)}</div>{!creditPix ? <div className="flex flex-col gap-2 sm:flex-row"><select value={creditType} onChange={(e) => setCreditType(e.target.value)} className="h-10 rounded border border-neutral-700 bg-[#222] px-3 text-sm text-white">{creditProductOptions.map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}</select><Input type="number" min={1} value={creditQuantity} onChange={(e) => setCreditQuantity(Number(e.target.value))} className="border-neutral-700 bg-[#222] text-white" placeholder="Quantidade" /><Button className="bg-emerald-600 hover:bg-emerald-700" disabled={creditCheckout.isPending} onClick={() => creditCheckout.mutate({ productType: creditType as any, quantity: creditQuantity })}>Comprar créditos via Pix</Button></div> : creditStatus.data?.approved ? <p className="text-sm font-bold text-emerald-300">Pagamento aprovado. Créditos adicionados.</p> : <div className="max-w-sm space-y-2 text-center"><img src={`data:image/png;base64,${creditPix.qrCodeBase64}`} alt="QR Code Pix" className="mx-auto h-44 w-44 rounded bg-white p-2" /><textarea readOnly value={creditPix.qrCode} className="min-h-20 w-full rounded border border-neutral-700 bg-[#222] p-2 text-xs" /><div className="grid gap-2 sm:grid-cols-2"><Button className="bg-blue-600" onClick={() => { navigator.clipboard.writeText(creditPix.qrCode); toast.success("Pix copiado."); }}>Copiar Pix</Button><Button className="bg-emerald-600" onClick={() => creditStatus.refetch()} disabled={creditStatus.isFetching}>Verificar pagamento</Button></div><p className="text-xs text-amber-300">Status: {creditStatus.data?.status || "pending"}</p><Button variant="outline" className="w-full border-red-800 bg-red-950/20 text-red-300" onClick={() => cancelCredit.mutate({ orderId: creditPix.orderId })} disabled={cancelCredit.isPending}>Cancelar compra</Button></div>}</CardContent></Card>

      {createdCredentials && (
        <Card className="bg-red-950/40 border-red-800 text-white p-4">
          <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Cliente Criado com Sucesso!</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-white">Copie as credenciais abaixo para enviar ao seu cliente (A Key é atribuída automaticamente pelo sistema e visível apenas no painel do cliente):</p>
            <div className="bg-black/60 p-3 rounded font-mono text-sm space-y-1">
              <div>Usuário: <strong className="text-white">{createdCredentials.username}</strong></div>
              <div>Senha: <strong className="text-white">{createdCredentials.password}</strong></div>
              <div>Link de ativação: <strong className="text-blue-400">https://shelbys-production.up.railway.app</strong></div>
            </div>
            <Button className="bg-red-600 hover:bg-red-700 text-white mt-2" onClick={() => {
              navigator.clipboard.writeText(`Usuário: ${createdCredentials.username}\nSenha: ${createdCredentials.password}\nLink de ativação: https://shelbys-production.up.railway.app`);
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
                {resellerProductOptions.map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}
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
              <label className="text-xs text-white font-semibold block mb-2">Selecione o produto para renovar este cliente:</label>
              <select className="w-full bg-[#222] border border-neutral-700 rounded p-2 text-white text-sm" value={renewType} onChange={(e: any) => setRenewType(e.target.value)}>
                {resellerProductOptions.map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}
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
                    {(data?.isPremium || c.ownerId === data?.resellerId || (c.ownerRole === "reseller" && !c.ownerIsPremium)) ? <Button size="sm" variant="outline" className="border-emerald-700 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50" onClick={() => { setRenewType(normalizeRenewalType(c.keyType)); setRenewingClient({ id: c.id, username: c.username }); }}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de outro painel</span>}
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

        <TabsContent value="androidPanel" className="space-y-4">
          <Card className="bg-orange-950/30 border-orange-800 text-white"><CardHeader><CardTitle className="text-white">Painel Android</CardTitle></CardHeader><CardContent><p className="text-sm text-orange-100">Clientes deste painel usam Keys, créditos e conteúdos exclusivos do tipo <strong>panel_android</strong>. A renovação troca a Key e consome crédito Painel Android; + Horas apenas estende a validade.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-white">Clientes Painel Android</CardTitle><Input className="w-72 bg-[#222] border-neutral-700 text-white text-xs" placeholder="Pesquisar cliente Android..." value={iosClientSearch} onChange={(e) => setIosClientSearch(e.target.value)} /></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Usuário</TableHead><TableHead className="text-white font-bold">Expiração</TableHead><TableHead className="text-white font-bold text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data?.clients?.filter((c: any) => c.keyType === "panel_android")?.filter((c: any) => c.username.toLowerCase().includes(iosClientSearch.toLowerCase())).map((c: any) => <TableRow key={c.id} className="border-neutral-800"><TableCell className="font-bold text-white">{c.username}</TableCell><TableCell className="text-emerald-400 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "Sem validade"}</TableCell><TableCell className="text-right space-x-1">{data?.isPremium || (c.ownerRole === "reseller" && !c.ownerIsPremium) ? <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setRenewType("panel_android"); setRenewingClient({ id: c.id, username: c.username }); }}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de Premium</span>}<Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300" onClick={() => { const hours = Number(prompt(`Quantas horas adicionar ao cliente ${c.username}?`)); if (Number.isInteger(hours) && hours > 0) addHoursMutation.mutate({ clientId: c.id, hours }); }}>+ Horas</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="proxyAndroidClientesPanel" className="space-y-4">
          <Card className="bg-orange-950/30 border-orange-800 text-white"><CardHeader><CardTitle className="text-white">Proxy Android Clientes</CardTitle></CardHeader><CardContent><p className="text-sm text-orange-100">Clientes deste painel usam Keys, créditos e conteúdos exclusivos do tipo <strong>proxy_android_clientes</strong>. A renovação troca a Key e consome crédito Proxy Android Clientes; + Horas apenas estende a validade.</p></CardContent></Card>
          <Card className="bg-[#141414] border-neutral-800 text-white"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-white">Clientes Proxy Android Clientes</CardTitle><Input className="w-72 bg-[#222] border-neutral-700 text-white text-xs" placeholder="Pesquisar cliente Proxy Android Clientes..." value={iosClientSearch} onChange={(e) => setIosClientSearch(e.target.value)} /></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-neutral-800"><TableHead className="text-white font-bold">Usuário</TableHead><TableHead className="text-white font-bold">Expiração</TableHead><TableHead className="text-white font-bold text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data?.clients?.filter((c: any) => c.keyType === "proxy_android_clientes")?.filter((c: any) => c.username.toLowerCase().includes(iosClientSearch.toLowerCase())).map((c: any) => <TableRow key={c.id} className="border-neutral-800"><TableCell className="font-bold text-white">{c.username}</TableCell><TableCell className="text-emerald-400 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "Sem validade"}</TableCell><TableCell className="text-right space-x-1">{data?.isPremium || (c.ownerRole === "reseller" && !c.ownerIsPremium) ? <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setRenewType("proxy_android_clientes"); setRenewingClient({ id: c.id, username: c.username }); }}>Renovar</Button> : <span className="text-[10px] text-neutral-500">Cliente de Premium</span>}<Button size="sm" variant="outline" className="border-blue-700 bg-blue-950/40 text-blue-300" onClick={() => { const hours = Number(prompt(`Quantas horas adicionar ao cliente ${c.username}?`)); if (Number.isInteger(hours) && hours > 0) addHoursMutation.mutate({ clientId: c.id, hours }); }}>+ Horas</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
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
                            { name: 'advanced', label: 'Android Advanced' },
                            { name: 'panel_ios', label: 'Painel iOS' },
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
  const [countdown, setCountdown] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
    const announcement = data?.announcements?.[0];
  const brandColor = data?.brandColor || "#dc2626";
  const [renewalNoticeOpen, setRenewalNoticeOpen] = useState(false);
  const [renewalNoticeSeconds, setRenewalNoticeSeconds] = useState(4);
  const [bannerVideoFailed, setBannerVideoFailed] = useState(false);
  const [contentUpdateOpen, setContentUpdateOpen] = useState(false);
  const latestContentUpdate = data?.latestContentUpdate;
  useEffect(() => {
    setBannerVideoFailed(false);
  }, [data?.bannerVideoUrl]);
  useEffect(() => {
    if (!data?.username || !latestContentUpdate?.key) return;
    const storageKey = `shelby-content-update-seen:${data.username}`;
    try {
      if (window.localStorage.getItem(storageKey) === latestContentUpdate.key) return;
      window.localStorage.setItem(storageKey, latestContentUpdate.key);
    } catch {
      // Se o armazenamento do navegador estiver indisponível, o estado da sessão ainda evita repetição.
    }
    setContentUpdateOpen(true);
  }, [data?.username, latestContentUpdate?.key]);
  useEffect(() => {
    if (!data || Number(data.renewalCount || 0) <= 2) {
      setRenewalNoticeOpen(false);
      return;
    }
    setRenewalNoticeOpen(true);
    setRenewalNoticeSeconds(4);
    const timer = window.setInterval(() => {
      setRenewalNoticeSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [data?.username, data?.renewalCount]);
  useEffect(() => {
    if (!announcement) {
      setCountdown(0);
      setShowAlert(false);
      return;
    }
    const duration = Math.max(1, Number(announcement.durationSeconds || 5));
    setCountdown(duration);
    setShowAlert(true);
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setShowAlert(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [announcement?.id, announcement?.durationSeconds]);

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
  const contentUpdateNotice = latestContentUpdate ? (
    <Dialog open={contentUpdateOpen} onOpenChange={setContentUpdateOpen}>
      <DialogContent className="z-[120] max-w-2xl border-red-600/60 bg-[#111111]/[0.99] p-0 text-white shadow-2xl shadow-red-950/50">
        <div className="relative overflow-hidden rounded-lg">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-red-600" style={{ backgroundColor: brandColor }} />
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-600/10 blur-3xl" style={{ backgroundColor: `${brandColor}22` }} />
          <DialogHeader className="relative space-y-4 p-8 pb-5 text-center sm:text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-500/30 bg-red-950/50 shadow-lg shadow-red-950/30" style={{ borderColor: `${brandColor}66`, backgroundColor: `${brandColor}22` }}>
              {latestContentUpdate.kind === "download" ? <DownloadIcon className="h-10 w-10" style={{ color: brandColor }} /> : <BookOpen className="h-10 w-10" style={{ color: brandColor }} />}
            </div>
            <DialogTitle className="text-center text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl" style={{ color: brandColor }}>
              NOVA ATUALIZAÇÃO DISPONÍVEL
            </DialogTitle>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Confira o novo conteúdo antes de continuar
            </p>
          </DialogHeader>
          <div className="relative space-y-5 px-8 pb-8 text-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: brandColor }}>
                {latestContentUpdate.kind === "download" ? "Novo download" : "Novo tutorial"}
              </p>
              <p className="mt-2 text-xl font-black text-white">{latestContentUpdate.title}</p>
              {latestContentUpdate.version && <p className="mt-1 text-sm text-neutral-400">Versão {latestContentUpdate.version}</p>}
            </div>
            <p className="text-sm leading-6 text-neutral-300">
              Uma atualização foi publicada para o seu produto. Acesse os downloads e os tutoriais para baixar o conteúdo correto e conferir as instruções de uso.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="flex-1 font-black text-white shadow-lg"
                style={{ backgroundColor: brandColor }}
                onClick={() => {
                  setContentUpdateOpen(false);
                  window.setTimeout(() => {
                    const target = document.getElementById(latestContentUpdate.kind === "download" ? "downloads-section" : "tutorials-section");
                    target?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 120);
                }}
              >
                {latestContentUpdate.kind === "download" ? <DownloadIcon className="mr-2 h-4 w-4" /> : <BookOpen className="mr-2 h-4 w-4" />}
                Ver atualização
              </Button>
              <Button type="button" variant="outline" className="flex-1 border-neutral-700 bg-transparent font-bold text-white hover:bg-neutral-800" onClick={() => setContentUpdateOpen(false)}>
                Continuar no painel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;
  const renewalNotice = (
    <Dialog
      open={renewalNoticeOpen}
      onOpenChange={(open) => {
        if (!open && renewalNoticeSeconds === 0) setRenewalNoticeOpen(false);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="z-[110] max-w-md border-red-600/60 bg-[#111111]/[0.98] p-0 text-white shadow-2xl shadow-red-950/40"
        onEscapeKeyDown={(event) => {
          if (renewalNoticeSeconds > 0) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (renewalNoticeSeconds > 0) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (renewalNoticeSeconds > 0) event.preventDefault();
        }}
      >
        <div className="relative overflow-hidden rounded-lg">
          <div className="absolute inset-x-0 top-0 h-1 bg-red-600" style={{ backgroundColor: brandColor }} />
          <DialogHeader className="space-y-3 p-6 pb-4 text-center sm:text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-950/50" style={{ borderColor: `${brandColor}66`, backgroundColor: `${brandColor}22` }}>
              <Lock className="h-7 w-7" style={{ color: brandColor }} />
            </div>
            <DialogTitle className="text-center text-2xl font-black uppercase tracking-[0.12em]" style={{ color: brandColor }}>
              AGUARDE XITADINHO
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 px-6 pb-6 text-center">
            <p className="text-sm font-semibold leading-6 text-neutral-200">
              OBRIGADO POR COMPRAR NOSSO XIT MAIS UMA VEZ. AGRADECEMOS!<br />
              DEIXE SEU FEEDBACK PRA MOTIVAR A CONTINUARMOS NESSA, TRAZENDO XITS BARATOS.
            </p>
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-red-600 transition-[width] duration-1000" style={{ width: `${((4 - renewalNoticeSeconds) / 4) * 100}%`, backgroundColor: brandColor }} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
                {renewalNoticeSeconds > 0 ? `Aguarde ${renewalNoticeSeconds} segundo${renewalNoticeSeconds === 1 ? "" : "s"}` : "Agora você pode continuar"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {renewalNoticeSeconds === 0 && (
                <a
                  href="https://discord.gg/Yu3KHxc4vw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-indigo-400/30 bg-indigo-950/50 px-4 py-2.5 text-xs font-bold text-indigo-200 transition-colors hover:bg-indigo-900/70 hover:text-white"
                >
                  Deixar feedback no Discord
                </a>
              )}
              <Button
                type="button"
                disabled={renewalNoticeSeconds > 0}
                onClick={() => setRenewalNoticeOpen(false)}
                className="flex-1 bg-red-600 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: renewalNoticeSeconds === 0 ? brandColor : undefined }}
              >
                {renewalNoticeSeconds > 0 ? `Fechar (${renewalNoticeSeconds})` : "Fechar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
  if (isLoading) return <div className="p-8 text-center text-white">Carregando painel...</div>;

  if (isExpired) {
    return (
      <>
        <div className="max-w-xl mx-auto mt-20 p-6 bg-[#141414] border rounded-xl text-white text-center space-y-4 shadow-2xl select-none" style={{ borderColor: brandColor, WebkitUserSelect: 'none' }}>
        <AlertTriangle className="w-16 h-16 mx-auto animate-bounce" style={{ color: brandColor }} />
        <h2 className="text-2xl font-bold" style={{ color: brandColor }}>Acesso Expirado</h2>
        <p className="text-sm text-neutral-300 font-medium">
          Seu login expirou, contate o suporte de {data?.brandName || "SHELBY PANEL"} para renovar.
        </p>
        <div className="pt-2">
          <a
            href={data?.discordUrl || "https://discord.gg/YYBZxhhm"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg transition"
            style={{ backgroundColor: brandColor }}
          >
            Contatar Suporte / Discord
          </a>
        </div>
        </div>
        {contentUpdateNotice}
        {renewalNotice}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto text-white select-none relative" style={{ WebkitUserSelect: 'none' }}>
      {/* Overlay anti-screen sharing / screenshot protection */}
      <div className="absolute inset-0 pointer-events-none z-50 flex items-start justify-end p-2 opacity-10 font-mono text-[10px] text-white overflow-hidden">
        SHELBY SECURE SESSION - NO SCREENSHARE
      </div>
      {(data?.bannerVideoUrl && !bannerVideoFailed || data?.bannerUrl) && (
        <Card className="overflow-hidden border-neutral-800 bg-[#141414] p-0 text-white shadow-xl">
          {data?.bannerVideoUrl && !bannerVideoFailed ? (
            <video
              src={data.bannerVideoUrl}
              className="max-h-72 w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={`Vídeo do banner de ${data.brandName || "SHELBY PANEL"}`}
              onError={() => setBannerVideoFailed(true)}
            />
          ) : data?.bannerUrl ? (
            <img
              src={data.bannerUrl}
              alt={`Banner de ${data.brandName || "SHELBY PANEL"}`}
              className="max-h-72 w-full object-cover"
              loading="lazy"
              onError={(event) => { event.currentTarget.style.display = "none"; }}
            />
          ) : null}
        </Card>
      )}
      {showAlert && announcement && (
        <Card className="bg-[#141414] border-red-600/50 text-white p-4 animate-fade-in shadow-xl">
          <div className="flex items-center gap-3 font-bold mb-2" style={{ color: brandColor }}>
            <AlertTriangle className="w-6 h-6" />
            <span>{announcement.title} ({countdown}s)</span>
          </div>
          <p className="whitespace-pre-wrap text-xs text-white">{announcement.message}</p>
        </Card>
      )}

      <Card className="bg-[#141414] border-neutral-800 text-white">
        <CardHeader><CardTitle className="text-white" style={{ color: brandColor }}>Suas Informações de Acesso</CardTitle></CardHeader>
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
                href={data?.discordUrl || "https://discord.gg/YYBZxhhm"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold px-4 py-2 rounded-lg transition"
                style={{ backgroundColor: brandColor }}
              >
                Entrar no Discord
              </a>
              <a
                href="https://wa.me/5515996945451?text=Quero%20suporte%20no%20Shelby%20Panel"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1ebe5d]"
              >
                Quero suporte no WhatsApp
              </a>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* DOWNLOADS */}
      <Card id="downloads-section" className="bg-[#141414] border-neutral-800 text-white">
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
      <Card id="tutorials-section" className="bg-[#141414] border-neutral-800 text-white">
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
                  {video?.kind === "video" && <video src={video.url} controls playsInline preload="none" className="w-full max-h-[520px] rounded-lg border border-neutral-700 bg-black" onError={() => toast.error("Este formato ou servidor não permite reprodução incorporada neste celular. Use o botão Abrir vídeo em nova aba.")} />}
                  {!video && <p className="text-xs text-amber-300">Este link não pode ser incorporado automaticamente.</p>}
                  <a href={t.videoUrl} target="_blank" rel="noopener noreferrer"><Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"><Video className="w-4 h-4 mr-2" /> Abrir vídeo em nova aba</Button></a>
                </div>;
              })
            )}
          </div>
        </CardContent>
      </Card>
      {contentUpdateNotice}
      {renewalNotice}
    </div>
  </>
  );
}
