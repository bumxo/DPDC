import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ChangePasswordForm } from "./change-password-form";
import { ChangeEmailForm } from "./change-email-form";
import { ResendVerification } from "./resend-verification";

export const metadata = { title: "Account — DPDC B2B" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await requireUser();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const verified = Boolean(user?.email_confirmed_at);
  const pendingEmail = user?.new_email ?? null;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Account settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Signed in as {profile.email} ({profile.role})
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Email</h2>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{user?.email}</span>
          {verified ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Verified
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Not verified
            </span>
          )}
        </div>

        {user?.email_confirmed_at && (
          <p className="mb-4 text-xs text-gray-400">
            Verified {formatDate(user.email_confirmed_at)}
          </p>
        )}

        {!verified && (
          <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="mb-2">
              Your email address hasn&apos;t been verified yet. Verify it so you
              can recover your account if you forget your password.
            </p>
            <ResendVerification />
          </div>
        )}

        {pendingEmail && (
          <p className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900">
            Change to <strong>{pendingEmail}</strong> is pending — click the
            verification link sent to that address to complete it.
          </p>
        )}

        <ChangeEmailForm currentEmail={user?.email ?? ""} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
