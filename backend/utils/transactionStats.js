// Define the AtlasStats structure
class AtlasStats {
    constructor(activeTVLSat, unconfirmedTVLSat, totalStakers, totalTVLSat) {
      this.activeTVLSat = activeTVLSat;
      this.unconfirmedTVLSat = unconfirmedTVLSat;
      this.totalStakers = totalStakers;
      this.totalTVLSat = totalTVLSat;
    }
  }
  
  const getTransactionsAndComputeStats = (
    deposits,
    redemptions,
    btcAtlasDepositAddress
  ) => {
    let activeTVLSat = 0;
    let unconfirmedTVLSat = 0;
    let totalStakers = 0;
    let totalTVLSat = 0;
  
    try {
      // Sum of btc_amount in deposits where status = 0
      unconfirmedTVLSat = deposits
        .filter(
          (deposit) =>
            deposit.status === 0 &&
            deposit.btc_sender_address !== btcAtlasDepositAddress
        )
        .reduce((sum, deposit) => sum + deposit.btc_amount, 0);
  
      // Count of unique btc_sender_address
      const uniqueAddresses = new Set(
        deposits.map((deposit) => deposit.btc_sender_address)
      );
      totalStakers = uniqueAddresses.size;
  
      // Sum of btc_amount in deposits where status != 0
      const activeTVLSatDeposits = deposits
        .filter(
          (deposit) =>
            deposit.status !== 0 &&
            deposit.btc_sender_address !== btcAtlasDepositAddress
        )
        .reduce((sum, deposit) => sum + deposit.btc_amount, 0);
  
      // Total abtc_amount in redemptions where status = 30
      const totalRedemptions = redemptions
        .filter((redemption) => redemption.status === 30)
        .reduce((sum, redemption) => sum + redemption.abtc_amount, 0);
  
      // Calculate activeTVLSat
      activeTVLSat = activeTVLSatDeposits - totalRedemptions;
  
      totalTVLSat = activeTVLSat + unconfirmedTVLSat;
  
    //   console.log(
    //     `Stats: activeTVLSat=${activeTVLSat}, unconfirmedTVLSat=${unconfirmedTVLSat}, totalStakers=${totalStakers}, totalTVLSat=${totalTVLSat}`
    //   );
    } catch (error) {
      console.error(
        `Failed to compute transactions and stats: ${error.message}`
      );
    }
  
    // Return the result as an instance of AtlasStats
    return new AtlasStats(activeTVLSat, unconfirmedTVLSat, totalStakers, totalTVLSat);
  };
  
  module.exports = { getTransactionsAndComputeStats, AtlasStats };
  