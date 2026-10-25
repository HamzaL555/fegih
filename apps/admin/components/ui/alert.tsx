import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  info: "border-primary/30 bg-primary/10 text-primary"
};

const icons = { error: AlertCircle, success: CheckCircle2, info: Info };

export function Alert({ className, variant = "info", children, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof styles }) {
  const Icon = icons[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-md border p-3 text-sm", styles[variant], className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
