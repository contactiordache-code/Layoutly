"use client";
import { cn } from "@/lib/utils";
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { createSwapy, type Config, type SwapEvent, type Swapy } from "swapy";

type SwapyLayoutProps = {
  id: string;
  className?: string;
  children: ReactNode;
  config?: Partial<Config>;
  onSwap?: (event: SwapEvent) => void;
};

// Creates a Swapy instance on the container. Slots and items inside it are marked with
// data-swapy-slot / data-swapy-item by the components below.
export function SwapyLayout({ id, className, children, config = {}, onSwap }: SwapyLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const swapyRef = useRef<Swapy | null>(null);
  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;
  // Callers usually pass an inline config object; only recreate Swapy when its content changes.
  const configKey = JSON.stringify(config);

  useEffect(() => {
    if (!containerRef.current) return;
    const swapy = createSwapy(containerRef.current, JSON.parse(configKey) as Partial<Config>);
    swapy.onSwap((event) => onSwapRef.current?.(event));
    swapyRef.current = swapy;
    return () => {
      swapy.destroy();
      swapyRef.current = null;
    };
  }, [configKey]);

  return (
    <div id={id} ref={containerRef} className={className}>
      {children}
    </div>
  );
}

type SlotProps = HTMLAttributes<HTMLDivElement> & { id: string };

export function SwapySlot({ id, className, children, ...props }: SlotProps) {
  return (
    <div data-swapy-slot={id} className={cn(className)} {...props}>
      {children}
    </div>
  );
}

export function SwapyItem({ id, className, children, ...props }: SlotProps) {
  return (
    <div data-swapy-item={id} className={cn(className)} {...props}>
      {children}
    </div>
  );
}

export function DragHandle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-swapy-handle className={cn("cursor-grab active:cursor-grabbing", className)} {...props} />;
}
