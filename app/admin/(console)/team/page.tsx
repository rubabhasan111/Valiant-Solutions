import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/dal";
import { listAdmins, listPendingInvites } from "@/lib/admin/invites";
import { formatDate, formatTimestamp } from "@/lib/schedule";
import { ConfirmButton } from "@/components/forms/ConfirmButton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { InviteForm } from "./InviteForm";
import { removeAdminAccount, revokeInvite } from "./actions";

export const metadata: Metadata = { title: "Team" };

const NOTICES: Record<string, string> = {
  "invite-revoked": "Invite cancelled. That link no longer works.",
  "nothing-to-revoke": "There was no open invite for that address.",
  "admin-removed": "Admin removed and signed out.",
};

export default async function AdminTeamPage({ searchParams }: PageProps<"/admin/team">) {
  const admin = await requireAdmin();
  const { notice } = await searchParams;

  const [admins, invites] = await Promise.all([listAdmins(), listPendingInvites()]);
  const message = typeof notice === "string" ? (NOTICES[notice] ?? decodeURIComponent(notice)) : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Team"
        description="Everyone here sees every workshop, plan and customer, and can suspend a workshop's access."
      />

      {message && (
        <p role="status" className="mt-6 rounded-2xl bg-accent-pale px-5 py-3 text-sm font-semibold text-accent-ink">
          {message}
        </p>
      )}

      <section className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <h2 className="text-lg font-bold">Invite someone</h2>
        <p className="mt-1 text-sm leading-relaxed text-body">
          You&apos;ll get a link to send them however you like. They choose their own password, so no password is ever
          sent around.
        </p>
        <div className="mt-5">
          <InviteForm />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Admins</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                <th scope="col" className="px-5 py-3 font-semibold">Added</th>
                <th scope="col" className="px-5 py-3 font-semibold">Last signed in</th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge border-t border-edge">
              {admins.map((member) => (
                <tr key={member.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold">
                      {member.name}
                      {member.id === admin.id && <span className="ml-2 text-xs font-normal text-mute">(you)</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-mute">{member.email}</p>
                  </td>
                  <td className="tabular px-5 py-4 text-body">{formatDate(member.created_at)}</td>
                  <td className="tabular px-5 py-4 text-body">
                    {member.last_signed_in_at ? formatTimestamp(member.last_signed_in_at) : "Never"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {member.id !== admin.id && (
                      <form action={removeAdminAccount.bind(null, member.id)}>
                        <ConfirmButton
                          className="text-sm font-semibold text-danger underline-offset-2 hover:underline"
                          pendingLabel="Removing"
                          confirmMessage={`Remove ${member.name}? They're signed out straight away and lose all access.`}
                        >
                          Remove
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Invites waiting to be used</h2>
        {invites.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-body">None.</p>
        ) : (
          <ul className="mt-3 divide-y divide-edge border-t border-edge">
            {invites.map((invite) => (
              <li key={invite.email} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {invite.name} <span className="font-normal text-mute">{invite.email}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-mute">
                    Invited {formatTimestamp(invite.created_at)}
                    {invite.invited_by_name ? ` by ${invite.invited_by_name}` : ""}, expires{" "}
                    {formatDate(invite.expires_at)}
                  </p>
                </div>
                <form action={revokeInvite.bind(null, invite.email)}>
                  <SubmitButton
                    pendingLabel="Cancelling"
                    className="text-sm font-semibold text-danger underline-offset-2 hover:underline"
                  >
                    Cancel invite
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
