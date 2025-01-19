"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { twMerge } from "tailwind-merge";

export interface TabsContextValue {
  dir: "vertical" | "horizontal";
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

const TabsRoot = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
    dirDisplay?: "vertical" | "horizontal";
  }
>(({ className, dirDisplay, ...props }, ref) => {
  const dir = dirDisplay ?? "horizontal";
  return (
    <TabsContext.Provider value={{ dir: dirDisplay ?? "horizontal" }}>
      <TabsPrimitive.Root
        ref={ref}
        className={twMerge(
          "flex",
          dir === "horizontal" && "flex-col",
          dir === "vertical" && "flex-row",
          className,
        )}
        {...props}
      />
    </TabsContext.Provider>
  );
});

TabsRoot.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const context = React.useContext(TabsContext);

  const dir = context?.dir ?? "horizontal";

  return (
    <TabsPrimitive.List
      ref={ref}
      className={twMerge(
        "flex gap-4 border-tab-list-border",
        dir === "vertical" && "flex-col min-w-[200px] border-r",
        dir === "horizontal" && "flex-row items-center border-b ",
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const context = React.useContext(TabsContext);

  const dir = context?.dir ?? "horizontal";

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={twMerge(
        "h-10 inline-flex items-center whitespace-nowrap px-6 py-2 text-base transition-colors disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-tab-active-bg data-[state=active]:text-tab-active-text data-[state=active]:border-tab-active-border data-[state=active]:font-semibold",
        dir === "horizontal" && "data-[state=active]:border-b-2 justify-center",
        dir === "vertical" && "data-[state=active]:border-r-2 justify-start",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  const context = React.useContext(TabsContext);

  const dir = context?.dir ?? "horizontal";

  return (
    <TabsPrimitive.Content
      ref={ref}
      className={twMerge(
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full",
        dir === "horizontal" && "mt-2 px-4 lg:px-6",
        dir === "vertical" && "ml-10 pr-4 lg:pr-6",
        className,
      )}
      {...props}
    />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { TabsContent, TabsList, TabsRoot, TabsTrigger };
