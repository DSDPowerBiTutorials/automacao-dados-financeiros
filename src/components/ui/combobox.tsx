"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface ComboboxOption {
    value: string;
    label: string;
    sublabel?: string;
}

interface ComboboxProps {
    options: ComboboxOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    addNewLabel?: string;
    className?: string;
    disabled?: boolean;
}

export function Combobox({
    options,
    value,
    onValueChange,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    addNewLabel,
    className,
    disabled,
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [addingNew, setAddingNew] = React.useState(false);
    const [newValue, setNewValue] = React.useState("");

    const selectedLabel = options.find((o) => o.value === value)?.label || value;

    const handleAddNew = () => {
        const trimmed = newValue.trim();
        if (trimmed) {
            onValueChange(trimmed);
            setNewValue("");
            setAddingNew(false);
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal h-10",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    <span className="truncate">
                        {value ? selectedLabel : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700" align="start">
                <Command className="bg-white dark:bg-[#0a0a0a]">
                    <CommandInput placeholder={searchPlaceholder} className="text-gray-900 dark:text-white" />
                    <CommandList>
                        {addNewLabel && (
                            <CommandGroup forceMount>
                                {!addingNew ? (
                                    <CommandItem
                                        value={`__add_new__${addNewLabel}`}
                                        onSelect={() => setAddingNew(true)}
                                        className="text-green-600 dark:text-green-400"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        {addNewLabel}
                                    </CommandItem>
                                ) : (
                                    <div className="flex items-center gap-2 p-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                        <Input
                                            value={newValue}
                                            onChange={(e) => setNewValue(e.target.value)}
                                            placeholder="Type new name..."
                                            className="h-8 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                e.stopPropagation();
                                                if (e.key === "Enter") handleAddNew();
                                                if (e.key === "Escape") { setAddingNew(false); setNewValue(""); }
                                            }}
                                        />
                                        <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white shrink-0" onClick={handleAddNew}>
                                            Add
                                        </Button>
                                    </div>
                                )}
                                <CommandSeparator />
                            </CommandGroup>
                        )}
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value === value ? "" : option.value);
                                        setOpen(false);
                                        setAddingNew(false);
                                    }}
                                    className="text-gray-900 dark:text-white"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{option.label}</span>
                                        {option.sublabel && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{option.sublabel}</span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
