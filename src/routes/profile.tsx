import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { User, Mail, Calendar, LogOut, ArrowLeft, Fingerprint, Plus, Check, Loader2, Trash2, Edit, Shield, Clock, Palette } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getRoleDisplayName, getRoleBadgeColor } from '../lib/roles'
import { updateTimeFormat } from '../lib/server/user-preferences'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTheme } from '@/providers/ThemeProvider'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

interface Passkey {
  id: string
  name?: string
  createdAt: Date
}

function ProfilePage() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const { theme, setTheme } = useTheme()
  const [isAddingPasskey, setIsAddingPasskey] = useState(false)
  const [passkeyAdded, setPasskeyAdded] = useState(false)
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(true)
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>((session?.user as any)?.timeFormat || '12h')
  const [isUpdatingTimeFormat, setIsUpdatingTimeFormat] = useState(false)

  // Redirect to auth if not logged in
  if (!isPending && !session) {
    navigate({ to: '/auth' })
    return null
  }

  // Fetch user's passkeys
  useEffect(() => {
    const fetchPasskeys = async () => {
      if (!session) return

      try {
        const response = await authClient.passkey.listUserPasskeys()
        setPasskeys(response?.data || [])
      } catch (error) {
        console.error('Failed to fetch passkeys:', error)
      } finally {
        setLoadingPasskeys(false)
      }
    }

    fetchPasskeys()
  }, [session, passkeyAdded])

  // Sync time format with session
  useEffect(() => {
    if (session?.user) {
      setTimeFormat((session.user as any)?.timeFormat || '12h')
    }
  }, [session])

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      navigate({ to: '/' })
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const handleAddPasskey = async () => {
    setIsAddingPasskey(true)
    setPasskeyAdded(false)
    try {
      await authClient.passkey.addPasskey({
        name: `${navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'Mac' : 'Device'} - ${new Date().toLocaleDateString()}`,
      })
      setPasskeyAdded(true)
      setTimeout(() => setPasskeyAdded(false), 3000)
    } catch (error) {
      console.error('Failed to add passkey:', error)
      alert('Failed to add passkey. Make sure your device supports WebAuthn.')
    } finally {
      setIsAddingPasskey(false)
    }
  }

  const handleRemovePasskey = async (passkeyId: string) => {
    if (!confirm('Are you sure you want to remove this passkey?')) {
      return
    }

    try {
      await authClient.passkey.deletePasskey({ id: passkeyId })
      // Refresh the passkeys list
      const response = await authClient.passkey.listUserPasskeys()
      setPasskeys(response?.data || [])
    } catch (error) {
      console.error('Failed to remove passkey:', error)
      alert('Failed to remove passkey. Please try again.')
    }
  }

  const handleTimeFormatChange = async (newFormat: '12h' | '24h') => {
    setIsUpdatingTimeFormat(true)
    try {
      // @ts-ignore - Server function typing
      const result = await updateTimeFormat({ data: { timeFormat: newFormat } })

      if (result.success) {
        toast.success(`Time format updated to ${newFormat === '12h' ? '12-hour' : '24-hour'}`)

        // Reload to refresh session
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    } catch (error) {
      console.error('Failed to update time format:', error)
      toast.error('Failed to update time format. Please try again.')
      setIsUpdatingTimeFormat(false)
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

  // Format date
  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (isPending || !session) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-pulse">Loading profile...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Button
        variant="ghost"
        onClick={() => navigate({ to: '/' })}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Events
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getUserInitials(session.user.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{session.user.name || 'User'}</CardTitle>
                <CardDescription>{session.user.email}</CardDescription>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Account Information</h3>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Name
                </Label>
                <Input
                  id="name"
                  value={session.user.name || ''}
                  disabled
                  className="bg-muted"
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={session.user.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Account Created
                </Label>
                <Input
                  value={formatDate(session.user.createdAt)}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Role
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={getRoleDisplayName((session.user as any).role)}
                    disabled
                    className="bg-muted"
                  />
                  <div className={`px-3 py-2 rounded-md border text-xs font-medium whitespace-nowrap ${getRoleBadgeColor((session.user as any).role)}`}>
                    {getRoleDisplayName((session.user as any).role)}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit/Save buttons - for future implementation */}
            {/* <div className="flex gap-2 mt-4">
              {isEditMode ? (
                <>
                  <Button onClick={() => setIsEditMode(false)}>
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditMode(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditMode(true)}>
                  Edit Profile
                </Button>
              )}
            </div> */}
          </div>

          {/* Preferences Section */}
          <div className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Preferences</h3>
            <div className="space-y-4">
              {/* Time Format Preference */}
              <div className="space-y-2">
                <Label htmlFor="timeFormat" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Format
                </Label>
                <Select
                  value={timeFormat}
                  onValueChange={(value) => handleTimeFormatChange(value as '12h' | '24h')}
                  disabled={isUpdatingTimeFormat}
                >
                  <SelectTrigger id="timeFormat" className="w-full">
                    <SelectValue placeholder="Select time format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (6:00 PM)</SelectItem>
                    <SelectItem value="24h">24-hour (18:00)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose how times are displayed across the app
                </p>
              </div>

              {/* Theme Preference */}
              <div className="space-y-2">
                <Label htmlFor="theme" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Theme
                </Label>
                <Select
                  value={theme}
                  onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                >
                  <SelectTrigger id="theme" className="w-full">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred color theme
                </p>
              </div>
            </div>
          </div>

          {/* Session Information */}
          <div className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Session Information</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session Status:</span>
                <span className="font-medium text-green-600 dark:text-green-400">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-xs">{session.user.id}</span>
              </div>
            </div>
          </div>

          {/* Passkey Section */}
          <div className="pt-6 border-t">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Fingerprint className="h-5 w-5" />
                  Passkey Authentication
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Use biometrics or security keys to sign in without passwords
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Existing Passkeys List */}
              {loadingPasskeys ? (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading passkeys...</span>
                  </div>
                </div>
              ) : passkeys.length > 0 ? (
                <div className="space-y-2">
                  {passkeys.map((passkey) => (
                    <div key={passkey.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-2">
                            <Fingerprint className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{passkey.name || 'Unnamed Passkey'}</p>
                            <p className="text-xs text-muted-foreground">
                              Added {new Date(passkey.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePasskey(passkey.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Add/Change Passkey Button */}
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Fingerprint className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {passkeys.length > 0 ? 'Add Another Passkey' : 'Add Passkey'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Secure passwordless authentication
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddPasskey}
                    disabled={isAddingPasskey}
                    size="sm"
                  >
                    {isAddingPasskey ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : passkeyAdded ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Added!
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        {passkeys.length > 0 ? 'Add Another' : 'Add Passkey'}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Info Box */}
              {passkeys.length === 0 && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="font-medium mb-2 text-sm">What are Passkeys?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• More secure than passwords</li>
                    <li>• Use Face ID, Touch ID, or Windows Hello</li>
                    <li>• Protected from phishing attacks</li>
                    <li>• No passwords to remember or type</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Other Security Options */}
          <div className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Other Security Options</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" disabled>
                Change Password
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                Two-Factor Authentication
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
