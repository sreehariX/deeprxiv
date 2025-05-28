"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <main>
      <div
        className={cn(
          "transition-bg relative flex h-[100vh] flex-col items-center justify-center bg-zinc-50 text-slate-950 dark:bg-zinc-900",
          className,
        )}
        {...props}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={
            {
              "--aurora":
                "repeating-linear-gradient(100deg,#1e40af_10%,#7c3aed_15%,#2563eb_20%,#9333ea_25%,#3b82f6_30%)",
              "--dark-gradient":
                "repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)",
              "--white-gradient":
                "repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)",

              "--blue-300": "#93c5fd",
              "--blue-400": "#60a5fa",
              "--blue-500": "#3b82f6",
              "--blue-800": "#1e40af",
              "--indigo-300": "#a5b4fc",
              "--violet-200": "#ddd6fe",
              "--purple-600": "#9333ea",
              "--purple-700": "#7c3aed",
              "--black": "#000",
              "--white": "#fff",
              "--transparent": "transparent",
            } as React.CSSProperties
          }
        >
          <div
            //   I'm sorry but this is what peak developer performance looks like // trigger warning
            className={cn(
              `after:animate-aurora pointer-events-none absolute -inset-[10px] [background-image:var(--white-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-80 blur-[8px] invert filter will-change-transform [--aurora:repeating-linear-gradient(100deg,var(--blue-800)_10%,var(--purple-700)_15%,var(--blue-500)_20%,var(--purple-600)_25%,var(--blue-400)_30%)] [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-difference after:content-[""] dark:[background-image:var(--dark-gradient),var(--aurora)] dark:invert-0 after:dark:[background-image:var(--dark-gradient),var(--aurora)]`,

              showRadialGradient &&
                `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`,
            )}
          ></div>
          {/* Additional aurora layer for more visibility */}
          <div
            className={cn(
              `after:animate-aurora pointer-events-none absolute -inset-[5px] [background-image:var(--aurora)] [background-size:400%,_300%] [background-position:0%_50%] opacity-60 blur-[15px] filter will-change-transform [--aurora:repeating-linear-gradient(45deg,var(--blue-500)_0%,var(--purple-600)_25%,var(--blue-400)_50%,var(--purple-700)_75%,var(--blue-800)_100%)] after:absolute after:inset-0 after:[background-image:var(--aurora)] after:[background-size:300%,_200%] after:[background-attachment:fixed] after:mix-blend-screen after:content-[""] dark:after:mix-blend-overlay`,
              showRadialGradient &&
                `[mask-image:radial-gradient(ellipse_at_50%_0%,black_20%,var(--transparent)_80%)]`,
            )}
          ></div>
        </div>
        {children}
      </div>
    </main>
  );
}; 