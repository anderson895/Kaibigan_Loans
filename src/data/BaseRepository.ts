import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";

/** Generic Firestore repository that maps documents to domain entities and back. */
export abstract class BaseRepository<TEntity, TProps extends { id: string }> {
  constructor(
    protected readonly db: Firestore,
    protected readonly collectionName: string,
  ) {}

  protected abstract toEntity(props: TProps): TEntity;
  protected abstract toProps(entity: TEntity): TProps;

  protected get collectionRef(): CollectionReference<DocumentData> {
    return collection(this.db, this.collectionName);
  }

  docRef(id: string): DocumentReference<DocumentData> {
    return doc(this.db, this.collectionName, id);
  }

  newDocRef(): DocumentReference<DocumentData> {
    return doc(this.collectionRef);
  }

  fromSnapshot(snapshot: DocumentSnapshot<DocumentData>): TEntity | null {
    if (!snapshot.exists()) return null;
    return this.toEntity({ ...(snapshot.data() as Omit<TProps, "id">), id: snapshot.id } as TProps);
  }

  /** Document payload without the id (the id lives in the document path). */
  toData(entity: TEntity): DocumentData {
    const { id: _id, ...data } = this.toProps(entity);
    return data;
  }

  async get(id: string): Promise<TEntity | null> {
    return this.fromSnapshot(await getDoc(this.docRef(id)));
  }

  async list(...constraints: QueryConstraint[]): Promise<TEntity[]> {
    const snapshot = await getDocs(query(this.collectionRef, ...constraints));
    return snapshot.docs.map((d) => this.fromSnapshot(d)!);
  }

  async create(entity: TEntity): Promise<string> {
    const ref = await addDoc(this.collectionRef, this.toData(entity));
    return ref.id;
  }

  async save(id: string, entity: TEntity): Promise<void> {
    await setDoc(this.docRef(id), this.toData(entity));
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }
}
