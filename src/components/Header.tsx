import { Link, useNavigate } from '@tanstack/react-router'
import { Image } from './Image'
import {
  Menubar,
} from '@/components/ui/menubar'
import {
  NavigationMenu,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, LogIn } from 'lucide-react'

import { authClient } from '../lib/auth-client'
import { getMenuItemsForRole } from '../data/menu-config'

export default function Header() {
  const navigate = useNavigate()

  // Get user session
  const { data: session } = authClient.useSession()

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      navigate({ to: '/' })
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  // Helper function to get user initials
  const getUserInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <>
      <header className="py-4 lg:px-6">
        <Menubar className="flex items-center justify-between p-4 shadow-none border-0">
          <h1 className="ml-1 lg:ml-4 text-xl font-semibold">
            <Link to="/">
              <Image
                src="/o8o.svg"
                alt="oh eight oh"
                width={100}
                height={50}
                className="h-10"
              />
            </Link>
            <p className="sr-only">oh eight oh</p>
          </h1>
          <NavigationMenu>
            <NavigationMenuList>
              {/* <NavigationMenuLink asChild>
                <Link to="/">Home</Link>
              </NavigationMenuLink> */}
              <NavigationMenuLink asChild>
                <Link to="/calendar" title='Calendar'>
                  Calendar
                </Link>
              </NavigationMenuLink>
              <NavigationMenuLink asChild>
                <Link to="/featured" title='Featured'>
                  Featured
                </Link>
              </NavigationMenuLink>
              <NavigationMenuLink asChild>
                <Link to="/bookmarks" title='Bookmarked'>
                  Bookmarked
                </Link>
              </NavigationMenuLink>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex items-center gap-4">
            {/* User session dropdown */}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-full"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getUserInitials(session.user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.user.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Render menu items based on user role */}
                  {getMenuItemsForRole(session.user.role).map((item) => {
                    const Icon = item.icon
                    return (
                      <DropdownMenuItem
                        key={item.path}
                        onClick={() => navigate({ to: item.path })}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    )
                  })}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="bg-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  title='Sign In'
                  onClick={() => navigate({ to: '/auth' })}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button> 
              </div>
            )}
          </div>
        </Menubar>
      </header>
    </>
  )
}
