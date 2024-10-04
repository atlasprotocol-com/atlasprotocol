# Bitcoin Staking dApp

The Bitcoin Staking dApp is a web application integrating with extension
wallets that allows a user to stake their Bitcoin.

## Frontend

To set up a development frontend environment, first specify the required environment
variables in the `.env.local` file in the root directory:

```
cp .env.example .env.local
```

where,

- `NEXT_PUBLIC_MEMPOOL_API` specifies the mempool.space host to use for Bitcoin
  node queries
- `NEXT_PUBLIC_API_URL` specifies the back-end API to use for the staking
  system queries
- `NEXT_PUBLIC_NETWORK` specifies the BTC network environment

Then, to start a development server:

```bash
npm install
npm run dev
```


## Backend

To set up a development backend environment, first specify the required environment
variables in the `.env.local` file in the root directory:

```
cd backend
cp .env.example .env.local
```

Then, to start a development server:

```bash
npm install
node server.js
```