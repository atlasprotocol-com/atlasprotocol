const unstakingConfig = {
  // Get appropriate unstaking period based on BitHive contract
  getUnstakingPeriod: async function(near) {
    try {
      const summary = await near.bitHiveContract.get_summary();
      return summary.withdrawal_waiting_time_ms;
    } catch (error) {
      console.error('Error getting unstaking period from BitHive:', error);
      // Fallback values in case of error
      return process.env.NODE_ENV !== 'production' ? 
        5 * 60 * 1000 : // 5 minutes for testnet
        2 * 24 * 60 * 60 * 1000; // 2 days for production
    }
  }
};

module.exports = unstakingConfig; 