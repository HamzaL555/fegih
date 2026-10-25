"use client";

import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";

export function UserMenu() {
  const { session, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (!session) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="max-w-36 truncate text-sm font-medium">{session.user.fullName || session.user.email}</p>
        <p className="text-xs text-muted-foreground">{session.user.role}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={handleLogout} aria-label="Çıxış et" title="Çıxış et">
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
}
