// src/constants.rs

pub mod status {
    // Deposit status constants as u8
    pub const DEP_BTC_PENDING_MEMPOOL: u8 = 0;
    pub const DEP_BTC_DEPOSITED_INTO_ATLAS: u8 = 10;
    pub const DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT: u8 = 11;
    pub const DEP_BTC_YIELD_PROVIDER_DEPOSITED: u8 = 20;
    pub const DEP_BTC_PENDING_MINTED_INTO_ABTC: u8 = 21;
    pub const DEP_BTC_MINTED_INTO_ABTC: u8 = 30;

    // Redemption status constants as u8
    pub const RED_ABTC_BURNT: u8 = 10;
    pub const RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE: u8 = 11;
    pub const RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING: u8 = 12;
    pub const RED_BTC_YIELD_PROVIDER_UNSTAKED: u8 = 13;
    pub const RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW: u8 = 14;
    pub const RED_BTC_YIELD_PROVIDER_WITHDRAWING: u8 = 15;
    pub const RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER: u8 = 21;
    pub const RED_BTC_PENDING_MEMPOOL_CONFIRMATION: u8 = 22;
    pub const RED_BTC_REDEEMED_BACK_TO_USER: u8 = 30;

    // Bridging status constants as u8
    pub const BRG_ABTC_PENDING_BURNT: u8 = 0;
    pub const BRG_ABTC_BURNT: u8 = 10;
    pub const BRG_ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST: u8 = 11;
    pub const BRG_ABTC_MINTED_TO_DEST: u8 = 20;
}

pub mod network_type {
    // different network types chain for validators
    pub const SIGNET: &'static str = "SIGNET";
    pub const BITCOIN: &'static str = "BITCOIN";
    pub const EVM: &'static str = "EVM";
    pub const NEAR: &'static str = "NEAR";
}

pub mod delimiter {
    // delimiters
    pub const COMMA: &'static str = ",";
}

pub mod near_gas {
    use near_sdk::{Gas, NearToken};

    pub const SIGN_CALLBACK_GAS: Gas = Gas::from_tgas(10);
    pub const GAS_FOR_STORAGE_DEPOSIT: Gas = Gas::from_tgas(10); // Gas for storage deposit call
    pub const GAS_FOR_MINT_CALL: Gas = Gas::from_tgas(100); // Gas for minting call
    pub const MIN_STORAGE_DEPOSIT: NearToken = NearToken::from_yoctonear(1250000000000000000000);
    // 0.00125 NEAR in yoctoNEAR
}
