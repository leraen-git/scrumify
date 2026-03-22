import { cn } from "@/lib/utils";
import * as React from "react";

type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-indigo-100 text-indigo-700",
  secondary: "bg-gray-100 text-gray-700",
  destructive: "bg-red-100 text-red-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  outline: "border border-gray-300 text-gray-700 bg-transparent",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
