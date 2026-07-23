import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatUserName, useAllUsers } from '@/features/auth/use-user-profiles'

import { UserManagementDialog } from './UserManagementDialog'

export function UsersPage() {
  const { profiles, isLoading } = useAllUsers()
  const sortedProfiles = [...profiles].sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Users</h1>
        <p className="text-muted-foreground mt-1">View accounts, edit personal info, reset passwords, and see booking history.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProfiles.map((profile) => (
              <TableRow key={profile.uid}>
                <TableCell className="font-medium">{formatUserName(profile)}</TableCell>
                <TableCell className="text-muted-foreground">{profile.email ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={profile.role === 'admin' ? 'success' : 'secondary'}>{profile.role}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <UserManagementDialog profile={profile} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
