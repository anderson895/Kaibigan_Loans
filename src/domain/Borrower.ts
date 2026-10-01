export interface BorrowerProps {
  id: string;
  name: string;
  email: string;
  phone: string;
  payoutDetails: string;
  createdAt: number;
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
    if (!name) throw new Error("Kailangan ang pangalan");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Kailangan ng tamang Gmail address");
    return new Borrower({ ...input, name, email, id: "", createdAt: Date.now() });
  }

  get id() { return this.props.id; }
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
