import type { Frequency } from "@/lib/schedule";
import { formatAud } from "@/lib/money";
import { FREQUENCY_LABEL, formatDate, formatShortDay } from "@/lib/schedule";

// The wording of every email and text a customer gets about their plan, kept together so
// the two channels always say the same thing. Emails are sent in the workshop's name and
// replies go to the workshop; texts start with the workshop's name so customers know who
// they're from.

export type EmailContent = { subject: string; text: string };

type Sender = {
  centreName: string;
  // The workshop's phone number, if it gave one, for customers with questions.
  centrePhone: string | null;
  customerName: string;
  description: string;
  // The customer's private plan page.
  link: string;
};

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0];
const signOff = (s: Sender) => `Questions? Reply to this email to reach ${s.centreName}.\n\n${s.centreName}`;
const smsQuestions = (s: Sender) => (s.centrePhone ? ` Questions? Call ${s.centrePhone}.` : "");

export function planLinkMessages(
  input: Sender & {
    totalCents: number;
    instalmentCount: number;
    frequency: Frequency;
    firstDueDate: string;
    firstAmountCents: number;
    // Payments are paused because the bank account on file couldn't be debited.
    paused: boolean;
    hasMobile: boolean;
  },
): { email: EmailContent; sms: string } {
  const name = firstName(input.customerName);

  if (input.paused) {
    return {
      email: {
        subject: `Please update your bank details for ${input.centreName}`,
        text: `Hi ${name},\n\nYour payments for ${input.description} are paused because your bank account couldn't be debited. Add bank details that can be debited here:\n${input.link}\n\nAny missed payment will be collected once your new details are set up.\n\n${signOff(input)}`,
      },
      sms: `${input.centreName}: your payments for ${input.description} are paused because your bank account couldn't be debited. Add new bank details here: ${input.link}`,
    };
  }

  const frequency = FREQUENCY_LABEL[input.frequency].toLowerCase();
  const reminderChannel = input.hasMobile ? "a text" : "an email";
  return {
    email: {
      subject: `Set up your repayment plan with ${input.centreName}`,
      text: [
        `Hi ${name},`,
        `${input.centreName} has set up a repayment plan for ${input.description}:`,
        `Total: ${formatAud(input.totalCents)}\nPayments: ${input.instalmentCount} ${frequency} payments\nFirst payment: ${formatAud(input.firstAmountCents)} on ${formatDate(input.firstDueDate)}`,
        `To start your plan, add your bank details on Stripe's secure page. It takes about two minutes:\n${input.link}`,
        `Each payment is taken by direct debit on its due date, and we'll send you ${reminderChannel} two days before each one.`,
        signOff(input),
      ].join("\n\n"),
    },
    sms: `${input.centreName}: your repayment plan for ${input.description} (${formatAud(input.totalCents)} over ${input.instalmentCount} ${frequency} payments) is ready. Add your bank details to start it: ${input.link}`,
  };
}

export function setupConfirmedEmail(
  input: Sender & {
    totalCents: number;
    instalments: { sequence: number; dueDate: string; amountCents: number }[];
    hasMobile: boolean;
  },
): EmailContent {
  const schedule = input.instalments
    .map((i) => `${i.sequence}. ${formatDate(i.dueDate)}: ${formatAud(i.amountCents)}`)
    .join("\n");
  return {
    subject: `Your repayment plan with ${input.centreName} is set up`,
    text: [
      `Hi ${firstName(input.customerName)},`,
      `Your direct debit is set up, and your repayment plan with ${input.centreName} is active.`,
      `${input.description}, ${formatAud(input.totalCents)}:\n${schedule}`,
      `Each payment is taken from your bank account on its due date, and direct debits can take a few business days to show on your statement. We'll send you ${input.hasMobile ? "a text" : "an email"} two days before each payment.`,
      `View your plan any time: ${input.link}`,
      signOff(input),
    ].join("\n\n"),
  };
}

export function planResumedEmail(input: Sender): EmailContent {
  return {
    subject: `Your plan with ${input.centreName} has resumed`,
    text: `Hi ${firstName(input.customerName)},\n\nThanks, your new bank details are saved and your payments for ${input.description} have resumed. Any missed payment will be collected in the next few days.\n\nView your plan: ${input.link}\n\n${signOff(input)}`,
  };
}

export function reminderMessages(
  input: Sender & { amountCents: number; dueDate: string; sequence: number; instalmentCount: number },
): { email: EmailContent; sms: string } {
  const day = formatShortDay(input.dueDate);
  const amount = formatAud(input.amountCents);
  return {
    sms: `${input.centreName}: reminder, your payment of ${amount} for ${input.description} will be debited on ${day}. Please make sure the funds are in your account.${smsQuestions(input)}`,
    email: {
      subject: `Your payment to ${input.centreName} is due on ${day}`,
      text: `Hi ${firstName(input.customerName)},\n\nA reminder that payment ${input.sequence} of ${input.instalmentCount} (${amount}) for ${input.description} will be debited from your bank account on ${formatDate(input.dueDate)}. Please make sure the funds are in your account.\n\nView your plan: ${input.link}\n\n${signOff(input)}`,
    },
  };
}

export function receiptEmail(
  input: Sender & {
    sequence: number;
    instalmentCount: number;
    amountCents: number;
    paidCents: number;
    totalCents: number;
    next: { amountCents: number; dueDate: string } | null;
  },
): EmailContent {
  const lines = [`Paid so far: ${formatAud(input.paidCents)} of ${formatAud(input.totalCents)}`];
  if (input.next) lines.push(`Next payment: ${formatAud(input.next.amountCents)} on ${formatDate(input.next.dueDate)}`);
  return {
    subject: `Payment received: ${formatAud(input.amountCents)} to ${input.centreName}`,
    text: `Hi ${firstName(input.customerName)},\n\nThanks, payment ${input.sequence} of ${input.instalmentCount} (${formatAud(input.amountCents)}) for ${input.description} has been received.\n\n${lines.join("\n")}\n\nView your plan: ${input.link}\n\n${signOff(input)}`,
  };
}

// Sent as Halfshaft, not as a workshop: one code covers every workshop the customer pays.
export function signInCodeMessages(input: { code: string; minutes: number; customerName: string }): {
  email: EmailContent;
  sms: string;
} {
  return {
    email: {
      subject: `${input.code} is your Halfshaft sign-in code`,
      text: `Hi ${firstName(input.customerName)},\n\nYour code to sign in and see your repayment plans is:\n\n${input.code}\n\nIt expires in ${input.minutes} minutes and can be used once. If you didn't ask for it, you can ignore this email.\n\nHalfshaft`,
    },
    sms: `${input.code} is your Halfshaft sign-in code. It expires in ${input.minutes} minutes.`,
  };
}

export function paymentFailedSms(input: Sender & { amountCents: number; retryText: string }): string {
  return `${input.centreName}: your payment of ${formatAud(input.amountCents)} for ${input.description} didn't go through. We'll try again ${input.retryText}, so please make sure the funds are in your account.${smsQuestions(input)}`;
}

export function bankDetailsNeededSms(input: Sender & { amountCents: number }): string {
  return `${input.centreName}: your payment of ${formatAud(input.amountCents)} for ${input.description} couldn't be taken from your bank account. Please add new bank details so your plan can continue: ${input.link}`;
}

export function paidOffEmail(input: Sender & { instalmentCount: number; totalCents: number; final: string }): EmailContent {
  return {
    subject: `Your ${input.centreName} plan is paid off`,
    text: `Hi ${firstName(input.customerName)},\n\n${input.final} All ${input.instalmentCount} payments (${formatAud(input.totalCents)}) for ${input.description} are complete, and no more debits will be taken.\n\n${signOff(input)}`,
  };
}

// The workshop put the plan on hold, e.g. for hardship or while a dispute is sorted out.
export function planOnHoldMessages(input: Sender & { resumeOn: string | null }): { email: EmailContent; sms: string } {
  const until = input.resumeOn
    ? `until ${formatDate(input.resumeOn)}, when they'll start again`
    : `until ${input.centreName} starts them again`;
  return {
    sms: `${input.centreName}: your payments for ${input.description} are on hold. Nothing will be debited ${input.resumeOn ? `until ${formatShortDay(input.resumeOn)}` : "until we let you know"}.${smsQuestions(input)}`,
    email: {
      subject: `Your payments to ${input.centreName} are on hold`,
      text: `Hi ${firstName(input.customerName)},\n\nYour payments for ${input.description} are on hold. Nothing will be debited from your bank account ${until}, and your remaining payment dates will move back by the time the plan was on hold.\n\nView your plan: ${input.link}\n\n${signOff(input)}`,
    },
  };
}

export function planHoldEndedMessages(
  input: Sender & { next: { amountCents: number; dueDate: string } | null },
): { email: EmailContent; sms: string } {
  const next = input.next ? `Your next payment of ${formatAud(input.next.amountCents)} is due on ${formatDate(input.next.dueDate)}.` : "";
  return {
    sms: `${input.centreName}: your payments for ${input.description} have started again.${input.next ? ` Next payment: ${formatAud(input.next.amountCents)} on ${formatShortDay(input.next.dueDate)}.` : ""}${smsQuestions(input)}`,
    email: {
      subject: `Your payments to ${input.centreName} have started again`,
      text: `Hi ${firstName(input.customerName)},\n\nYour plan for ${input.description} is no longer on hold, and payments will be debited on their due dates again. ${next}\n\nView your plan: ${input.link}\n\n${signOff(input)}`,
    },
  };
}

export function planCancelledMessages(input: Sender): { email: EmailContent; sms: string } {
  return {
    sms: `${input.centreName}: your repayment plan for ${input.description} has been cancelled. No more payments will be debited.${smsQuestions(input)}`,
    email: {
      subject: `Your repayment plan with ${input.centreName} has been cancelled`,
      text: `Hi ${firstName(input.customerName)},\n\nYour repayment plan for ${input.description} has been cancelled, and no more payments will be debited from your bank account.\n\n${signOff(input)}`,
    },
  };
}

export function directDebitCancelledSms(input: Sender): string {
  return `${input.centreName}: your direct debit for ${input.description} was cancelled, so your remaining payments are on hold. To set it up again: ${input.link}`;
}
