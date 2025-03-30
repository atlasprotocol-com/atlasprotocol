interface UnisatProvider {
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  getNetwork(): Promise<string>;
  getPublicKey(): Promise<string>;
  signPsbt(psbtHex: string): Promise<string>;
  signPsbts(psbtsHexes: string[]): Promise<string[]>;
  signMessage(message: string, type: string): Promise<string>;
  on(eventName: string, callback: (args: any) => void): void;
}

interface Window {
  unisat?: UnisatProvider;
} 