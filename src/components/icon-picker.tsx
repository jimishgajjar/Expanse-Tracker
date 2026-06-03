"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Icon } from "@/components/icon";
import { ICON_NAMES } from "@/lib/icons";

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color?: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="icon" aria-label="Pick an icon" />}
      >
        <Icon name={value} color={color} size={18} />
        <ChevronDown className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search icons…" />
          <CommandList>
            <CommandEmpty>No icon found.</CommandEmpty>
            <CommandGroup>
              <div className="grid grid-cols-6 gap-1">
                {ICON_NAMES.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    onSelect={() => {
                      onChange(name);
                      setOpen(false);
                    }}
                    className="grid aspect-square place-items-center p-0"
                  >
                    <Icon name={name} size={18} color={name === value ? color : undefined} />
                  </CommandItem>
                ))}
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
