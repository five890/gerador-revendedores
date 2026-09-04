import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Store() {
  const { data: products, isLoading } = trpc.store.listProducts.useQuery();
  const [selected, setSelected] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const checkout = trpc.store.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => { window.location.href = checkoutUrl; },
    onError: (error) => toast.error(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    checkout.mutate({ productId: selected.id, username: username.trim(), password });
  };

  return <main className="min-h-screen bg-[#0b0b0b] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Link>
      <div className="mb-10 max-w-2xl"><p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-red-400">Acesso instantâneo</p><h1 className="text-4xl font-black tracking-tight sm:text-5xl">Escolha seu produto</h1><p className="mt-4 text-neutral-400">Pague com segurança e receba seu login automaticamente após a aprovação do pagamento.</p></div>
      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div> : products?.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{products.map((product: any) => <Card key={product.id} className="overflow-hidden border-neutral-800 bg-[#151515] text-white transition hover:-translate-y-1 hover:border-red-500/60">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center bg-gradient-to-br from-red-950 to-neutral-900"><ShoppingBag className="h-12 w-12 text-red-400/70" /></div>}<CardHeader><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-red-400">{product.category}</p><CardTitle className="mt-1 text-xl">{product.name}</CardTitle></div><span className="whitespace-nowrap text-xl font-black text-emerald-400">R$ {Number(product.price).toFixed(2).replace(".", ",")}</span></div></CardHeader><CardContent><p className="min-h-12 text-sm leading-relaxed text-neutral-400">{product.description}</p><Button className="mt-5 w-full bg-red-600 font-bold hover:bg-red-700" onClick={() => setSelected(product)}>Comprar agora</Button></CardContent></Card>)}</div> : <Card className="border-neutral-800 bg-[#151515] text-center text-neutral-400"><CardContent className="py-16">Nenhum produto disponível no momento.</CardContent></Card>}
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><Card className="w-full max-w-md border-neutral-700 bg-[#171717] text-white"><CardHeader><CardTitle>Finalizar compra: {selected.name}</CardTitle><p className="text-sm text-neutral-400">Crie os dados do acesso que será liberado após a aprovação.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input required minLength={3} maxLength={64} placeholder="Nome de usuário" value={username} onChange={(e) => setUsername(e.target.value)} className="border-neutral-700 bg-neutral-900 text-white" /><Input required minLength={4} maxLength={128} type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="border-neutral-700 bg-neutral-900 text-white" /><div className="flex gap-3"><Button type="button" variant="outline" className="flex-1 border-neutral-700 bg-transparent text-white" onClick={() => setSelected(null)}>Cancelar</Button><Button type="submit" disabled={checkout.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700">{checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Ir para pagamento</>}</Button></div></form></CardContent></Card></div>}
    </div>
  </main>;
}
