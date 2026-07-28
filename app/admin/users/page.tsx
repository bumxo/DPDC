import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import type { Role } from "@/lib/types";
import { CreateUserForm } from "./create-user-form";
import { UserRowActions } from "./user-row-actions";

export const dynamic = "force-dynamic";

export interface UserRow {
  id: string;
  email: string;
  company: string | null;
  role: Role;
  verified: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

async function loadUsers(): Promise<UserRow[]> {
  const admin = createAdminClient();

  // Auth holds verification and sign-in data; profiles holds role and company.
  const users: UserRow[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    users.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email ?? "(no email)",
        company: null,
        role: "customer" as Role,
        verified: Boolean(u.email_confirmed_at),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      }))
    );

    if (data.users.length < 200) break;
    page += 1;
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role, company");

  const byId = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as { role: Role; company: string | null }])
  );
  for (const u of users) {
    const p = byId.get(u.id);
    if (p) {
      u.role = p.role;
      u.company = p.company;
    }
  }

  return users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default async function AdminUsersPage() {
  let users: UserRow[] = [];
  let loadError: string | null = null;

  try {
    users = await loadUsers();
  } catch (e) {
    loadError = (e as Error).message;
  }

  if (loadError) {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold">Accounts</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-2 font-semibold">User management is unavailable</p>
          <p className="mb-2">{loadError}</p>
          <p>
            This page needs the <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            environment variable on the server. Add it in Vercel → Settings →
            Environment Variables (and to <code>.env.local</code> for local
            development), then redeploy. Keep it server-side only — never
            prefix it with <code>NEXT_PUBLIC_</code>.
          </p>
        </div>
      </div>
    );
  }

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <p className="mt-1 text-sm text-gray-500">
          {users.length} account{users.length === 1 ? "" : "s"} · {adminCount}{" "}
          admin{adminCount === 1 ? "" : "s"}
        </p>
      </div>

      <CreateUserForm />

      <div className="mt-8 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{user.email}</span>
                    {!user.verified && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        unverified
                      </span>
                    )}
                  </div>
                  {user.company && (
                    <p className="text-xs text-gray-500">{user.company}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-brand-100 text-brand-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {formatDate(user.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {user.lastSignInAt ? formatDate(user.lastSignInAt) : "never"}
                </td>
                <td className="px-4 py-3">
                  <UserRowActions user={user} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
