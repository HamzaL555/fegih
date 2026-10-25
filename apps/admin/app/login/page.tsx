"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { useAuth, isAdminRole } from "@/lib/auth/provider";
import { toApiError } from "@/lib/api/error";
import { loginSchema, type LoginFormValues } from "@/schemas/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session, isLoading, login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" }
  });

  useEffect(() => {
    if (isLoading || !session) return;
    router.replace(isAdminRole(session.user.role) ? "/dashboard" : "/forbidden");
  }, [isLoading, router, session]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const next = await login(values);
      if (!isAdminRole(next.user.role)) {
        setServerError("Bu hesab admin və ya super-admin roluna malik deyil.");
        return;
      }
      router.replace("/dashboard");
    } catch (error) {
      setServerError(toApiError(error).message);
    }
  });

  return (
    <main className="islamic-grid relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><BookOpen className="h-7 w-7" /></span>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Fegih</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Admin Panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">İdarəetmə panelinə daxil olun</p>
        </div>

        <Card className="border-primary/15 bg-card/95 shadow-2xl shadow-emerald-950/10">
          <CardHeader>
            <CardTitle>Giriş</CardTitle>
            <CardDescription>Admin hesabınızla daxil olun</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {serverError ? <Alert variant="error">{serverError}</Alert> : null}
              <div className="space-y-2">
                <Label htmlFor="identifier">E-poçt, telefon və ya istifadəçi adı</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="identifier" type="text" autoComplete="username" className="pl-9" aria-invalid={Boolean(errors.identifier)} aria-describedby={errors.identifier ? "identifier-error" : undefined} {...register("identifier")} />
                </div>
                {errors.identifier ? <p id="identifier-error" className="text-sm text-destructive">{errors.identifier.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifrə</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="pl-9 pr-10" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
                  {/* Reveal toggle: mistyped admin passwords are common and
                      there is no other way to check what was entered. */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
                    aria-pressed={showPassword}
                    className="absolute right-0 top-0 flex h-9 w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password ? <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p> : null}
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Giriş edilir…</> : "Daxil ol"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-muted-foreground">Token yalnız bu brauzer sessiyasında saxlanılır və səhifə bağlananda silinir.</p>
      </div>
    </main>
  );
}
