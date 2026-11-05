/**
 * Componentes base no estilo shadcn/ui (copiados no projeto, sem dependência externa),
 * com a identidade azul-marinho/branco.
 */
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-navy-900 text-white hover:bg-navy-800",
        secondary: "border border-navy-100 bg-white text-navy-900 hover:bg-navy-50",
        ghost: "text-navy-900 hover:bg-navy-50",
        danger: "border border-red-200 bg-white text-danger hover:bg-red-50",
      },
      size: { sm: "h-8 px-3", md: "h-9 px-4", lg: "h-10 px-5" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-navy-100 bg-white", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-3.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-semibold text-navy-950", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export const inputClass =
  "h-9 w-full rounded-lg border border-navy-100 bg-white px-3 text-sm text-navy-950 placeholder:text-navy-300 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-xs font-medium text-navy-900", className)} {...props} />;
}

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-navy-50 text-navy-700",
      success: "bg-emerald-50 text-success",
      warning: "bg-amber-50 text-warning",
      danger: "bg-red-50 text-danger",
      navy: "bg-navy-900 text-white",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="animate-rise mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="animate-rise rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-6 py-10 text-center">
      <p className="text-sm font-medium text-navy-950">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
export const th = "border-b border-navy-100 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted";
export const td = "border-b border-navy-50 px-4 py-2.5 text-navy-950";
