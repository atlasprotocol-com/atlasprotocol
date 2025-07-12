import axios from "axios";
import { v4 as uuidv4 } from "uuid";

interface LinkedWallet {
  address: string;
  type: "BTC" | "NEAR" | "EVM";
  isOnboardingComplete: boolean;
}

interface WalletMappingResponse {
  wallets: string[];
}

const API_BASE_URL = "https://api-uat.atlasprotocol.com/api/v1";
const UUID_STORAGE_KEY = "atlas_user_uuid";
const UUID_EXPIRY_KEY = "atlas_uuid_expiry";

class UUIDService {
  private static instance: UUIDService;
  private currentUUID: string | null = null;
  
  static getInstance(): UUIDService {
    if (!UUIDService.instance) {
      UUIDService.instance = new UUIDService();
    }
    return UUIDService.instance;
  }

  /**
   * Generate a new UUID v4 using the standard uuid library
   */
  private generateUUID(): string {
    return uuidv4();
  }

  /**
   * Check if stored UUID is still valid (not expired)
   */
  private isUUIDValid(): boolean {
    const expiry = localStorage.getItem(UUID_EXPIRY_KEY);
    if (!expiry) return false;
    
    const expiryTime = parseInt(expiry, 10);
    return Date.now() < expiryTime;
  }

  /**
   * Store UUID with expiry (7 days)
   */
  private storeUUID(uuid: string): void {
    const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    localStorage.setItem(UUID_STORAGE_KEY, uuid);
    localStorage.setItem(UUID_EXPIRY_KEY, expiryTime.toString());
    this.currentUUID = uuid;
  }

  /**
   * Get existing UUID from storage or create a new one
   */
  getOrCreateUUID(): string {
    // Return cached UUID if available
    if (this.currentUUID) {
      return this.currentUUID;
    }

    // Check if browser storage is available
    if (typeof window === "undefined") {
      // Server-side: generate temporary UUID
      this.currentUUID = this.generateUUID();
      return this.currentUUID;
    }

    // Try to get existing UUID from storage
    const storedUUID = localStorage.getItem(UUID_STORAGE_KEY);
    
    if (storedUUID && this.isUUIDValid()) {
      console.log("Using existing UUID:", storedUUID);
      this.currentUUID = storedUUID;
      return storedUUID;
    }

    // Generate new UUID if none exists or expired
    const newUUID = this.generateUUID();
    console.log("Generated new UUID:", newUUID);
    this.storeUUID(newUUID);
    return newUUID;
  }

  /**
   * Force refresh UUID (for testing or user logout)
   */
  refreshUUID(): string {
    const newUUID = this.generateUUID();
    this.storeUUID(newUUID);
    console.log("Refreshed UUID:", newUUID);
    return newUUID;
  }

  /**
   * Get current UUID without creating a new one
   */
  getCurrentUUID(): string | null {
    return this.currentUUID || localStorage.getItem(UUID_STORAGE_KEY);
  }

  /**
   * Clear stored UUID
   */
  clearUUID(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(UUID_STORAGE_KEY);
      localStorage.removeItem(UUID_EXPIRY_KEY);
    }
    this.currentUUID = null;
  }

  /**
   * Link a wallet address to the current UUID
   */
  async linkWalletToUUID(uuid: string, walletAddress: string): Promise<void> {
    try {
      console.log(`Linking wallet ${walletAddress} to UUID ${uuid}`);
      
      const response = await axios.post(
        `${API_BASE_URL}/wallet/maps/${uuid}`,
        { walletAddress },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log("Wallet linked successfully:", response.data);
    } catch (error) {
      console.error("Failed to link wallet to UUID:", error);
      
      if (axios.isAxiosError(error)) {
        const message = error?.response?.data?.message || error.message;
        throw new Error(`Failed to link wallet: ${message}`);
      } else {
        throw new Error("Failed to link wallet to UUID");
      }
    }
  }

  /**
   * Get all wallets linked to a UUID
   */
  async getLinkedWallets(uuid: string): Promise<LinkedWallet[]> {
    try {
      console.log(`Getting linked wallets for UUID ${uuid}`);
      
      const response = await axios.get<WalletMappingResponse>(
        `${API_BASE_URL}/wallet/maps`,
        {
          params: { q: uuid },
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const wallets = response.data.wallets || [];
      console.log("Linked wallets:", wallets);

      // Convert wallet addresses to LinkedWallet objects
      // We'll need to check onboarding status for each wallet
      const linkedWallets: LinkedWallet[] = [];
      
      for (const walletAddress of wallets) {
        try {
          // Import here to avoid circular dependency
          const { onboardingApi } = await import("./onboardingApi");
          const status = await onboardingApi.checkOnboardingStatus(walletAddress, "onboarding");
          
          // Determine wallet type based on address format
          let walletType: "BTC" | "NEAR" | "EVM" = "EVM";
          if (walletAddress.endsWith(".near") || walletAddress.endsWith(".testnet")) {
            walletType = "NEAR";
          } else if (walletAddress.length >= 26 && walletAddress.length <= 35 && 
                     (walletAddress.startsWith("1") || walletAddress.startsWith("3") || 
                      walletAddress.startsWith("bc1") || walletAddress.startsWith("tb1"))) {
            walletType = "BTC";
          }

          linkedWallets.push({
            address: walletAddress,
            type: walletType,
            isOnboardingComplete: status.isCompleted,
          });
        } catch (error) {
          console.error(`Failed to check status for wallet ${walletAddress}:`, error);
          // Still add the wallet but assume onboarding is not complete
          linkedWallets.push({
            address: walletAddress,
            type: "EVM", // Default fallback
            isOnboardingComplete: false,
          });
        }
      }

      return linkedWallets;
    } catch (error) {
      console.error("Failed to get linked wallets:", error);
      
      if (axios.isAxiosError(error)) {
        const message = error?.response?.data?.message || error.message;
        throw new Error(`Failed to get linked wallets: ${message}`);
      } else {
        throw new Error("Failed to get linked wallets");
      }
    }
  }

  /**
   * Check if a specific wallet is already linked to the UUID
   */
  async isWalletLinked(uuid: string, walletAddress: string): Promise<boolean> {
    try {
      const linkedWallets = await this.getLinkedWallets(uuid);
      return linkedWallets.some(
        wallet => wallet.address.toLowerCase() === walletAddress.toLowerCase()
      );
    } catch (error) {
      console.error("Failed to check if wallet is linked:", error);
      return false;
    }
  }

  /**
   * Check if any linked wallet has completed onboarding
   */
  async hasCompletedOnboarding(uuid: string): Promise<boolean> {
    try {
      const linkedWallets = await this.getLinkedWallets(uuid);
      return linkedWallets.some(wallet => wallet.isOnboardingComplete);
    } catch (error) {
      console.error("Failed to check onboarding completion:", error);
      return false;
    }
  }

  /**
   * Get the priority wallet (BTC → NEAR → EVM) from linked wallets
   */
  async getPriorityWallet(uuid: string): Promise<LinkedWallet | null> {
    try {
      const linkedWallets = await this.getLinkedWallets(uuid);
      
      if (linkedWallets.length === 0) return null;

      // Priority order: BTC → NEAR → EVM
      const btcWallet = linkedWallets.find(wallet => wallet.type === "BTC");
      if (btcWallet) return btcWallet;

      const nearWallet = linkedWallets.find(wallet => wallet.type === "NEAR");
      if (nearWallet) return nearWallet;

      const evmWallet = linkedWallets.find(wallet => wallet.type === "EVM");
      if (evmWallet) return evmWallet;

      // Fallback to first wallet
      return linkedWallets[0];
    } catch (error) {
      console.error("Failed to get priority wallet:", error);
      return null;
    }
  }

  /**
   * Debug method to log current UUID info
   */
  debugInfo(): void {
    console.log("UUID Service Debug Info:", {
      currentUUID: this.currentUUID,
      storedUUID: typeof window !== "undefined" ? localStorage.getItem(UUID_STORAGE_KEY) : null,
      expiry: typeof window !== "undefined" ? localStorage.getItem(UUID_EXPIRY_KEY) : null,
      isValid: this.isUUIDValid(),
    });
  }
}

export const uuidService = UUIDService.getInstance();