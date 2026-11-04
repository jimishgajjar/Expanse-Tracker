"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  House,
  Receipt,
  Wallet,
  CalendarDays,
  TrendingUp,
  Settings,
  Plus,
  ArrowRightLeft,
  Download,
  Moon,
  Sun,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Icon } from "@/components/icon";
import { useExportHref } from "./settings-provider";
import type { AccountDTO, CategoryDTO } from "@/lib/queries";

export function CommandPalette({
  accounts,
  categories,
  onNavigateTab,
  onOpenNewTransaction,
  onOpenNewTransfer,
  open: controlledOpen,
  onOpenChange,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  onNavigateTab: (tab: string) => void;
  onOpenNewTransaction?: () => void;
  onOpenNewTransfer?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const router = useRouter();
  const exportHref = useExportHref();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    if (controlledOpen !== undefined) return;
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K" || e.code === "KeyK") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [controlledOpen, open, setOpen]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Quick search"
      description="Search commands, accounts, and categories"
    >
      <CommandInput placeholder="Type a command or destination…" />
      <CommandList>
        <CommandEmpty>No matching commands or destinations found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick actions">
          {onOpenNewTransaction && (
            <CommandItem
              value="new transaction add expense income record payment"
              onSelect={() => runCommand(onOpenNewTransaction)}
            >
              <Plus className="size-4 text-brand" />
              <span>New transaction</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
          )}
          {onOpenNewTransfer && (
            <CommandItem
              value="new transfer move money between accounts"
              onSelect={() => runCommand(onOpenNewTransfer)}
            >
              <ArrowRightLeft className="size-4 text-brand" />
              <span>New transfer</span>
              <CommandShortcut>T</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem
            value="export financial data csv json download"
            onSelect={() =>
              runCommand(() => {
                window.location.href = exportHref;
              })
            }
          >
            <Download className="size-4 text-muted-foreground" />
            <span>Export financial data</span>
          </CommandItem>
          <CommandItem
            value="toggle theme switch dark light mode appearance"
            onSelect={() =>
              runCommand(() => {
                setTheme(theme === "dark" ? "light" : "dark");
              })
            }
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span>Toggle theme</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem
            value="overview home dashboard net worth summary"
            onSelect={() => runCommand(() => onNavigateTab("overview"))}
          >
            <House className="size-4" />
            <span>Overview</span>
          </CommandItem>
          <CommandItem
            value="activity ledger transactions history search"
            onSelect={() => runCommand(() => onNavigateTab("transactions"))}
          >
            <Receipt className="size-4" />
            <span>Activity ledger</span>
          </CommandItem>
          <CommandItem
            value="accounts balances bank cards cash"
            onSelect={() => runCommand(() => onNavigateTab("accounts"))}
          >
            <Wallet className="size-4" />
            <span>Accounts</span>
          </CommandItem>
          <CommandItem
            value="planning bills subscriptions recurring savings goals"
            onSelect={() => runCommand(() => onNavigateTab("planning"))}
          >
            <CalendarDays className="size-4" />
            <span>Planning and bills</span>
          </CommandItem>
          <CommandItem
            value="insights analytics trends reports charts cash flow"
            onSelect={() => runCommand(() => onNavigateTab("analytics"))}
          >
            <TrendingUp className="size-4" />
            <span>Insights and analytics</span>
          </CommandItem>
          <CommandItem
            value="settings preferences profile currency locale configuration"
            onSelect={() => runCommand(() => onNavigateTab("settings"))}
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Accounts */}
        {accounts.length > 0 && (
          <CommandGroup heading="Accounts">
            {accounts.map((a) => (
              <CommandItem
                key={a.id}
                value={`account ${a.name} ${a.type}`}
                onSelect={() => runCommand(() => router.push(`/accounts/${a.id}`))}
              >
                <span style={{ color: a.color }}>
                  <Icon name={a.icon} size={15} />
                </span>
                <span>{a.name}</span>
                <span className="text-[11px] text-muted-foreground capitalize">
                  {a.type}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Categories */}
        {categories.length > 0 && (
          <CommandGroup heading="Categories">
            {categories.slice(0, 15).map((c) => (
              <CommandItem
                key={c.id}
                value={`category ${c.name} ${c.kind}`}
                onSelect={() => runCommand(() => router.push(`/categories/${c.id}`))}
              >
                <span style={{ color: c.color }}>
                  <Icon name={c.icon} size={15} />
                </span>
                <span>{c.name}</span>
                <span className="text-[11px] text-muted-foreground capitalize">
                  {c.kind}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-lg border border-border/80 bg-muted/30 hover:bg-muted/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer shadow-2xs motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98]"
      aria-label="Open command palette (Cmd+K)"
    >
      <span className="flex items-center gap-2">
        <Search className="size-3.5 text-muted-foreground group-hover:text-foreground" />
        <span>Search or jump to…</span>
      </span>
      <kbd className="inline-flex h-4.5 select-none items-center gap-1 rounded border border-border/80 bg-card px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
