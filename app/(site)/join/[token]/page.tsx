import type { Metadata } from "next";
import Link from "next/link";
import { readStaffInvite } from "@/lib/workshop-team";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = {
  title: "Join your workshop on Halfshaft",
  robots: { index: false, follow: false },
};

// Reads the database, so it must never be served from a cache.
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const invite = await readStaffInvite(token);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight">
        {invite ? `Join ${invite.centre_name}` : "That invite doesn't work"}
      </h1>

      {invite ? (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">
            {invite.invited_by_name ?? "The workshop's owner"} added you to {invite.centre_name}&apos;s Halfshaft account
            as <span className="font-semibold text-ink">{invite.email}</span>. Choose a password and you&apos;re in.
          </p>
          <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
            <JoinForm token={token} name={invite.name} email={invite.email} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">
            Invites work once and expire after 7 days. Ask the workshop&apos;s owner to send a new one.
          </p>
          <Link href="/login" className="btn btn-secondary mt-8">
            Log in
          </Link>
        </>
      )}
    </main>
  );
}
