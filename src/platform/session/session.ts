export type SessionStatus =
  | 'disabled'
  | 'loading'
  | 'signed-out'
  | 'signed-in'
  | 'misconfigured';

interface SessionOperations {
  getToken(): Promise<string | null>;
  signOut(): Promise<void>;
}

interface SessionBase extends SessionOperations {
  readonly userId: string | null;
}

export interface DisabledSession extends SessionBase {
  readonly status: 'disabled';
  readonly userId: null;
}

export interface LoadingSession extends SessionBase {
  readonly status: 'loading';
  readonly userId: null;
}

export interface SignedOutSession extends SessionBase {
  readonly status: 'signed-out';
  readonly userId: null;
}

export interface SignedInSession extends SessionBase {
  readonly status: 'signed-in';
  readonly userId: string;
}

export interface MisconfiguredSession extends SessionBase {
  readonly message: string;
  readonly status: 'misconfigured';
  readonly userId: null;
}

export type AppSession =
  | DisabledSession
  | LoadingSession
  | SignedOutSession
  | SignedInSession
  | MisconfiguredSession;

const getNoToken = async (): Promise<null> => null;
const signOutNoSession = async (): Promise<void> => undefined;

export const disabledSession: DisabledSession = Object.freeze({
  getToken: getNoToken,
  signOut: signOutNoSession,
  status: 'disabled',
  userId: null,
});

export const loadingSession: LoadingSession = Object.freeze({
  getToken: getNoToken,
  signOut: signOutNoSession,
  status: 'loading',
  userId: null,
});

export const signedOutSession: SignedOutSession = Object.freeze({
  getToken: getNoToken,
  signOut: signOutNoSession,
  status: 'signed-out',
  userId: null,
});

export const createMisconfiguredSession = (
  message: string,
): MisconfiguredSession =>
  Object.freeze({
    getToken: getNoToken,
    message,
    signOut: signOutNoSession,
    status: 'misconfigured',
    userId: null,
  });

interface CreateSignedInSessionOptions extends SessionOperations {
  readonly userId: string;
}

export const createSignedInSession = ({
  getToken,
  signOut,
  userId,
}: CreateSignedInSessionOptions): SignedInSession =>
  Object.freeze({
    getToken,
    signOut,
    status: 'signed-in',
    userId,
  });
