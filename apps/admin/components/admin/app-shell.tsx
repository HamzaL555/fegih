"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Bell,
  BookOpen,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  FolderTree,
  Gift,
  Layers,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  ShoppingBag,
  UploadCloud,
  Users,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { useAuth } from "@/lib/auth/provider";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<string>;
};

const navigation: Array<NavItem> = [
  { href: "/dashboard", label: "İdarəetmə paneli", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/users", label: "İstifadəçilər", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/questions", label: "Suallar", icon: CircleGauge, roles: ["SUPER_ADMIN", "ADMIN", "EDITOR", "QUESTION_MANAGER"] },
  { href: "/question-levels", label: "Səviyyələr", icon: Layers, roles: ["SUPER_ADMIN", "ADMIN", "EDITOR", "QUESTION_MANAGER"] },
  { href: "/questions/import", label: "Sual idxalı", icon: UploadCloud, roles: ["SUPER_ADMIN", "ADMIN", "EDITOR", "QUESTION_MANAGER"] },
  { href: "/books", label: "Kitablar", icon: BookOpen, roles: ["SUPER_ADMIN", "ADMIN", "EDITOR"] },
  { href: "/categories", label: "Kitab kateqoriyaları", icon: FolderTree, roles: ["SUPER_ADMIN", "ADMIN", "EDITOR"] },
  { href: "/orders", label: "Sifarişlər", icon: ShoppingBag, roles: ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER"] },
  { href: "/rewards", label: "Mükafatlar", icon: Gift, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/achievements", label: "Nailiyyətlər", icon: Award, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/missions", label: "Missiyalar", icon: ClipboardCheck, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/notifications", label: "Bildirişlər", icon: Bell, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/messages", label: "Mesajlar", icon: MessageSquare, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/content", label: "İslami kontent", icon: BookOpen, roles: ["SUPER_ADMIN", "ADMIN", "EDITOR"] },
  { href: "/settings", label: "Tənzimləmələr", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" aria-label="Fegih admin ana səhifəsi">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <BookOpen className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-lg font-semibold tracking-tight">Fegih</span>
        <span className="block text-xs text-muted-foreground">Admin Panel</span>
      </span>
    </Link>
  );
}

function NavItems({ pathname, onNavigate, userRole }: { pathname: string; onNavigate?: () => void; userRole?: string | null }) {
  const normalizedRole = userRole?.trim().toUpperCase() ?? '';
  const items = navigation.filter((item) => item.roles.includes(normalizedRole));

  return (
    <nav className="space-y-1" aria-label="Əsas naviqasiya">
      {items.map((item) => {
        // Exact match always highlights. For child paths (e.g. "/questions/123"),
        // highlight the parent — but NOT when we're on the "/import" sibling,
        // because then only "/questions/import" should be active.
        const isExact = pathname === item.href;
        const onImportSibling = navigation.some(
          (sibling) => sibling.href === item.href + '/import' && pathname === sibling.href,
        );
        const startsWithChild = pathname.startsWith(`${item.href}/`) && !onImportSibling;
        const shouldHighlight = isExact || startsWithChild;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={shouldHighlight ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              shouldHighlight ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {shouldHighlight ? <ChevronRight className="h-4 w-4 opacity-70" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userRole = session?.user.role ?? null;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-card/80 px-4 py-5 backdrop-blur lg:block">
        <div className="px-2"><Brand /></div>
        <div className="mt-7"><NavItems pathname={pathname} userRole={userRole} /></div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} aria-label="Menyunu bağla" />
          <aside className="relative h-full w-[min(20rem,88vw)] border-r border-border bg-card p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between px-2">
              <Brand />
              <Button type="button" variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Menyunu bağla"><X className="h-5 w-5" /></Button>
            </div>
            <NavItems pathname={pathname} onNavigate={() => setMobileOpen(false)} userRole={userRole} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menyunu aç"><Menu className="h-5 w-5" /></Button>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <span>Fegih</span><span>/</span><span className="capitalize text-foreground">{pathname.split("/").filter(Boolean).at(-1) || "dashboard"}</span>
          </div>
          <div className="ml-auto flex items-center gap-1"><ThemeToggle /><UserMenu /></div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
