import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireWorkshop } from "@/lib/auth/dal";
import { formatDate, formatTimestamp } from "@/lib/schedule";
import { listPendingStaffInvites, listTeam } from "@/lib/workshop-team";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ConfirmButton } from "@/components/forms/ConfirmButton";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { cancelStaffInvite, removeStaff } from "./actions";
import { BusinessForm, InviteStaffForm, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

const TEAM_NOTICES = {
  removed: "Removed. They've been signed out and can't log in any more.",
  "invite-cancelled": "Invite cancelled. That link no longer works.",
  nothing: "Nothing changed: that person or invite was already gone.",
} as const;

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-edge bg-surface p-5 md:p-7">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-body">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const { user, centre, role } = await requireWorkshop();
  const owner = role === "owner";
  const { team: teamParam } = await searchParams;
  const teamNotice =
    typeof teamParam === "string" && teamParam in TEAM_NOTICES ? TEAM_NOTICES[teamParam as keyof typeof TEAM_NOTICES] : null;

  const [team, invites] = owner
    ? await Promise.all([listTeam(centre.id), listPendingStaffInvites(centre.id)])
    : [[], []];

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader title="Settings" description={owner ? "Your login, your workshop's details, and your team." : "Your login."} />

      <div className="mt-8 grid gap-6">
        <Section title="Business details" description={owner ? undefined : "Only the workshop's owner can change these."}>
          {owner ? (
            <BusinessForm name={centre.name} phone={centre.phone ?? ""} email={centre.email} />
          ) : (
            <dl className="grid gap-3 text-sm">
              {[
                ["Business name", centre.name],
                ["Phone number for customers", centre.phone ?? "Not set"],
                ["Business email", centre.email],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-mute">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {owner && (
            <p className="mt-4 text-xs leading-relaxed text-mute">
              The name on your customers&apos; bank statements and your payout bank account are managed by Stripe, under
              Payouts.
            </p>
          )}
        </Section>

        {owner && (
          <Section
            title="Team"
            description="Staff can create plans and customers, put plans on hold, and record payments. They can't change these settings, see the payment export, or change where Stripe pays you."
          >
            {teamNotice && (
              <p role="status" className="mb-5 rounded-2xl bg-accent-pale px-4 py-3 text-sm font-semibold text-accent-ink">
                {teamNotice}
              </p>
            )}

            <ul className="divide-y divide-edge rounded-2xl border border-edge">
              {team.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {member.name}
                      {member.id === user.id && <span className="ml-2 text-xs font-normal text-mute">(you)</span>}
                    </p>
                    <p className="text-xs text-mute">
                      {member.email} · {member.role === "owner" ? "Owner" : "Staff"} ·{" "}
                      {member.last_login_at ? `last signed in ${formatTimestamp(member.last_login_at)}` : "not signed in recently"}
                    </p>
                  </div>
                  {member.role === "staff" && (
                    <form action={removeStaff.bind(null, member.id)}>
                      <ConfirmButton
                        className="text-sm font-semibold text-danger underline-offset-2 hover:underline"
                        pendingLabel="Removing"
                        confirmMessage={`Remove ${member.name}? They're signed out straight away and can't log in again.`}
                      >
                        Remove
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>

            {invites.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-bold">Invites not used yet</h3>
                <ul className="mt-2 divide-y divide-edge rounded-2xl border border-edge">
                  {invites.map((invite) => (
                    <li key={invite.email} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {invite.name} <span className="font-normal text-mute">{invite.email}</span>
                        </p>
                        <p className="text-xs text-mute">
                          Invited {formatTimestamp(invite.created_at)}, expires {formatDate(invite.expires_at)}
                        </p>
                      </div>
                      <form action={cancelStaffInvite.bind(null, invite.email)}>
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
              </>
            )}

            <h3 className="mt-6 text-sm font-bold">Add someone</h3>
            <p className="mt-1 text-sm text-body">
              You&apos;ll get a link to send them. They choose their own password, so you never share yours.
            </p>
            <div className="mt-4">
              <InviteStaffForm />
            </div>
          </Section>
        )}

        <Section title="Your login">
          <ProfileForm name={user.name} email={user.email} />
        </Section>

        <Section title="Password" description="Changing it signs you out everywhere else.">
          <PasswordForm />
        </Section>
      </div>
    </main>
  );
}
