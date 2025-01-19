# Atlas Protocol Backend

## TODOs

- Update state transition with ABC strategy what is belong to transaction model
- Refactor code with chain of responsibility design pattern
- Implement API for better administrator tasks
- Using this timestamp checking is not safe if server is crashed
  ```
   const earliestTimestamp = Math.min(
      ...filteredTxns.map((bridging) => bridging.timestamp),
    );
  ```