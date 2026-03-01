import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/app/actions/auth";

interface HeaderProps {
  orgName: string;
  userEmail: string;
}

export function Header({ orgName, userEmail }: HeaderProps) {
  const initials = userEmail
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="text-sm text-muted-foreground">{orgName}</div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
            {userEmail}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <form action={logout}>
              <button type="submit" className="w-full text-left">
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
