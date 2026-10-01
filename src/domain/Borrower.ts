export interface BorrowerProps {
  id: string;
  name: string;
  email: string;
  phone: string;
  payoutDetails: string;
  createdAt: number;
  /** When the user accepted the Terms and Conditions (set when the profile is created at sign-up). */
  termsAcceptedAt?: number;
}

export type BorrowerInput = Omit<BorrowerProps, "id" | "createdAt">;

export class Borrower {
  private constructor(private readonly props: BorrowerProps) {}

  static fromProps(props: BorrowerProps): Borrower {
    return new Borrower({ ...props });
  }

  static create(input: BorrowerInput): Borrower {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) throw new Error("Name is required");
    // Email is optional: borrowers who won't use the website can be added by name only.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email, or leave it empty");
    return new Borrower({ ...input, name, email, id: "", createdAt: Date.now() });
  }

  /** False for borrowers added by the admin without an email — they can't sign in to the website. */
  get hasEmail(): boolean {
    return this.props.email.length > 0;
  }

  /** Borrower profile created automatically when a user registers; the doc id is their auth uid. */
  static forRegisteredUser(uid: string, name: string, email: string): Borrower {
    const created = Borrower.create({ name: name.trim() || email.split("@")[0], email, phone: "", payoutDetails: "" });
    // Profiles are only created for users who signed up through the app, which requires accepting the terms.
    return new Borrower({ ...created.toProps(), id: uid, termsAcceptedAt: Date.now() });
  }

  get id() { return this.props.id; }
  get createdAt() { return this.props.createdAt; }
  get name() { return this.props.name; }
  get email() { return this.props.email; }
  get phone() { return this.props.phone; }
  get payoutDetails() { return this.props.payoutDetails; }

  update(changes: Partial<BorrowerInput>): Borrower {
    const next = Borrower.create({ ...this.props, ...changes });
    return new Borrower({ ...next.toProps(), id: this.props.id, createdAt: this.props.createdAt });
  }

  toProps(): BorrowerProps {
    return { ...this.props };
  }
}
