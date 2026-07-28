import Link from "next/link";

export const metadata = { title: "Link problem — DPDC B2B" };

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="mb-2 text-2xl font-bold">This link didn&apos;t work</h1>
      <p className="mb-1 text-sm text-gray-600">
        Email links expire after a short time and can only be used once.
      </p>
      {searchParams.reason && (
        <p className="mb-4 text-xs text-gray-400">({searchParams.reason})</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/forgot-password"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Request a new link
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
