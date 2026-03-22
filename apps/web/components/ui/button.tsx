"use client";

import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

type Variant = "default" | "destructive" | "outline" | "ghost" | "link" | "secondary";
type Size = "default" | "sm" | "lg" | "icon";

const variants: Record<Variant, string> = {
  default: "bg-indigo-600 text-white shadow-xs hover:bg-indigo-500",
  destructive: "bg-red-600 text-white shadow-xs hover:bg-red-500",
  outline: "border border-gray-300 bg-white text-gray-700 shadow-xs hover:bg-gray-50",
  secondary: "bg-gray-100 text-gray-800 shadow-xs hover:bg-gray-200",
  ghost: "hover:bg-gray-100 text-gray-700",
  link: "text-indigo-600 underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
  lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
  icon: "size-9",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all cursor-pointer",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
