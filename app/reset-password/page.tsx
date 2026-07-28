import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Set a new password — DPDC B2B" };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Set a new password</h1>
      <p className="mb-6 text-sm text-gray-500">
        Choose a new password for your account.
      </p>
      <ResetPasswordForm />
    </div>
  );
}
