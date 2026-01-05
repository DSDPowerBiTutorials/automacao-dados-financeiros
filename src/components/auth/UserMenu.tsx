"use client";

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings, Shield } from 'lucide-react';

export function UserMenu() {
    const { profile, signOut } = useAuth();
    const router = useRouter();

    if (!profile) return null;

    const getRoleBadge = (role: string) => {
        const roleConfig: Record<string, { label: string; color: string }> = {
            admin: { label: 'Admin', color: 'bg-red-100 text-red-800 border-red-300' },
            finance_manager: { label: 'Manager', color: 'bg-blue-100 text-blue-800 border-blue-300' },
            analyst: { label: 'Analyst', color: 'bg-green-100 text-green-800 border-green-300' },
            viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-800 border-gray-300' },
        };

        const config = roleConfig[role] || roleConfig.viewer;
        return <Badge className={`${config.color} border`}>{config.label}</Badge>;
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full hover:opacity-80 transition-opacity"
                >
                    <Avatar className="h-10 w-10 border-2 border-[#243140]">
                        {profile.avatar_url && (
                            <AvatarImage src={profile.avatar_url} alt={profile.name} />
                        )}
                        <AvatarFallback className="bg-[#243140] text-white font-semibold">
                            {getInitials(profile.name)}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-72 bg-white shadow-lg"
                align="end"
                sideOffset={5}
            >
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{profile.name}</p>
                            {getRoleBadge(profile.role)}
                        </div>
                        <p className="text-xs text-gray-500">{profile.email}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Shield className="w-3 h-3" />
                            <span>{profile.company_code}</span>
                            {profile.department && (
                                <>
                                    <span>•</span>
                                    <span>{profile.department}</span>
                                </>
                            )}
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={() => signOut()}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
