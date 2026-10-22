import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatUserName, useAllUsers } from '@/features/auth/use-user-profiles'
import { usePaginatedSearch } from '@/lib/use-paginated-search'

import { ROLE_BADGE_VARIANT, UserManagementDialog } from './UserManagementDialog'

export function UsersPage() {
  const { profiles, isLoading } = useAllUsers()
  // Admins first, then by name
  const sortedProfiles = [...profiles].sort(
    (a, b) => Number(b.role === 'admin') - Number(a.role === 'admin') || formatUserName(a).localeCompare(formatUserName(b)),
  )
  const { query, setQuery, filtered, visible, hasMore, loadMore } = usePaginatedSearch(
    sortedProfiles,
    (profile, q) =>
      formatUserName(profile).toLowerCase().includes(q) ||
      (profile.email ?? '').toLowerCase().includes(q) ||
      profile.role.toLowerCase().includes(q),
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Users</h1>
        <p className="text-muted-foreground mt-1">View accounts, edit personal info, reset passwords, and see booking history.</p>
      </div>

      <Input
        placeholder="Search by name, email, or role…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No users match your search.</p>
      ) : (
        <>
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
              {visible.map((profile) => (
                <TableRow key={profile.uid}>
                  <TableCell className="font-medium">{formatUserName(profile)}</TableCell>
                  <TableCell className="text-muted-foreground">{profile.email ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE_VARIANT[profile.role]}>{profile.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <UserManagementDialog profile={profile} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasMore && (
            <Button variant="outline" onClick={loadMore} className="self-center">
              Load more ({filtered.length - visible.length} remaining)
            </Button>
          )}
        </>
      )}
    </div>
  )
}
