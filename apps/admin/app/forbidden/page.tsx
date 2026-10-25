"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/provider";

export default function ForbiddenPage() {
  const { logout } = useAuth();
  return (
    <main className="islamic-grid flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <ShieldX className="h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-semibold">Giriş qadağan edildi</h1>
          <p className="mt-2 text-sm text-muted-foreground">Bu hesabın admin panelinə giriş rolu yoxdur.</p>
          <div className="mt-6 flex gap-2">
            <Button asChild><Link href="/login" onClick={logout}>Başqa hesabla daxil ol</Link></Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
