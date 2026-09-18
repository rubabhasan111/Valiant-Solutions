import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "@phosphor-icons/react/ssr";
import { readAdminInvite } from "@/lib/admin/invites";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata: Metadata = {
  title: "Halfshaft admin invite",
  robots: { index: false, follow: false },
};

// Reads the database, so it must never be served from a cache.
export const dynamic = "force-dynamic";

export default async function AdminInvitePage({ params }: PageProps<"/admin/invite/[token]">) {
  const { token } = await params;
  const invite = await readAdminInvite(token);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <span className="grid size-11 place-items-center rounded-2xl bg-ink text-canvas">
        <ShieldCheck size={24} weight="bold" />
      </span>
      <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight">
        {invite ? "Join Halfshaft admin" : "That invite doesn't work"}
      </h1>

      {invite ? (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">
            {invite.invited_by_name ? `${invite.invited_by_name} invited` : "You've been invited"} you to{" "}
            <span className="font-semibold text-ink">{invite.email}</span>. Choose a password and you&apos;re in.
          </p>
          <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
            <AcceptInviteForm token={token} name={invite.name} />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Admins can see every workshop, plan and customer on Halfshaft, and can suspend a workshop&apos;s access.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">
            Invites work once and expire after 7 days. Ask whoever invited you to send a new one.
          </p>
          <Link href="/admin/login" className="btn btn-secondary mt-8">
            Admin sign in
          </Link>
        </>
      )}
    </main>
  );
}
