/**
 * CustomerCombobox
 * 可搜索的客户下拉选择组件，基于 shadcn/ui Command + Popover 实现。
 * 支持键盘导航，客户多时可快速搜索定位。
 */
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Customer {
  id: number;
  name: string;
  country?: string | null;
  email?: string | null;
}

interface CustomerComboboxProps {
  value: string;
  onChange: (value: string) => void;
  customers: Customer[];
  placeholder?: string;
  className?: string;
}

export default function CustomerCombobox({
  value,
  onChange,
  customers,
  placeholder = "请选择客户（必填）",
  className,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedCustomer = customers.find(c => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 text-sm justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedCustomer
              ? selectedCustomer.name
              : placeholder
            }
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="搜索客户名称..."
          />
          <CommandList>
            {customers.length === 0 ? (
              <CommandEmpty>
                <div className="py-4 text-center text-xs text-muted-foreground">
                  暂无预设客户，请先到「客户管理」中添加
                </div>
              </CommandEmpty>
            ) : (
              <>
                <CommandEmpty>
                  <div className="py-3 text-center text-xs text-muted-foreground">
                    未找到匹配的客户
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {customers.map(c => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={(currentValue) => {
                        onChange(currentValue === value ? "" : currentValue);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === c.name ? "opacity-100 text-[#1A3C5E]" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{c.name}</span>
                        {c.email && (
                          <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>
                        )}
                      </div>
                      {c.country && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full shrink-0",
                          c.country === "overseas"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-gray-100 text-gray-500"
                        )}>
                          {c.country === "overseas" ? "国外" : "国内"}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
