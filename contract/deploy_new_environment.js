const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

const { Near } = require('../backend/services/near');
const { Ethereum } = require('../backend/services/ethereum');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configuration for NEAR connection
const nearConfig = {

    networkId: process.env.NEAR_NETWORK_ID,
    nodeUrl: process.env.NEAR_NODE_URL,
    walletUrl: process.env.NEAR_WALLET_URL,
    helperUrl: process.env.NEAR_HELPER_URL,
    explorerUrl: process.env.NEAR_EXPLORER_URL,
    contractId: process.env.NEAR_CONTRACT_ID,
    mpcContractId: process.env.NEAR_MPC_CONTRACT_ID,
    accountId: process.env.NEAR_ACCOUNT_ID,
    pk: process.env.NEAR_PRIVATE_KEY,
    gas: process.env.NEAR_DEFAULT_GAS,
};

// Compile the Solidity contract first
console.log('Compiling Solidity contract...');
try {
    const nodeModulesPath = path.resolve(__dirname, '../node_modules');
    const contractPath = path.resolve(__dirname, 'tokens/solidity_contract');
    execSync(`cd tokens/solidity_contract && npx solc --bin --abi atBTC.sol -o artifacts --base-path ${contractPath} --include-path ${nodeModulesPath}`, { stdio: 'inherit' });
    
    // Copy the compiled files to the main artifacts directory
    if (!fs.existsSync('./artifacts')) {
        fs.mkdirSync('./artifacts');
    }

    // Read and format the ABI
    const abiContent = fs.readFileSync('./tokens/solidity_contract/artifacts/atBTC_sol_atBTC.abi', 'utf8');
    const formattedAbi = JSON.stringify(JSON.parse(abiContent), null, 2);
    fs.writeFileSync('./artifacts/atBTC.abi', abiContent);

    // Copy the binary file as is
    fs.copyFileSync('./tokens/solidity_contract/artifacts/atBTC_sol_atBTC.bin', './artifacts/atBTC.bin');
    
    console.log('Contract compiled successfully');
} catch (error) {
    console.error('Failed to compile contract:', error);
    process.exit(1);
}

// Read the chain configurations
const chainConfigs = JSON.parse(fs.readFileSync('./chain_chains_manual.json', 'utf8'));

// Read the contract ABI
const contractABI = JSON.parse(fs.readFileSync('./artifacts/atBTC.abi', 'utf8'));

// Read the contract bytecode
const contractBytecode = fs.readFileSync('./tokens/solidity_contract/artifacts/atBTC_sol_atBTC.bin', 'utf8');

async function checkWalletBalances(wallet, chainConfigs) {
    const balances = {};
    for (const chain of chainConfigs.chains) {
        if (chain.network_type === 'EVM') {
            const provider = new ethers.JsonRpcProvider(chain.chain_rpc_url);
            const balance = await provider.getBalance(wallet.address);
            balances[chain.network_name] = ethers.formatEther(balance);
        }
    }
    return balances;
}

async function deployContract(chainConfig, privateKey) {
    try {
        // Create provider and wallet
        const provider = new ethers.JsonRpcProvider(chainConfig.chain_rpc_url);
        const wallet = new ethers.Wallet(privateKey, provider);

        console.log(`\nDeploying to ${chainConfig.network_name} (${chainConfig.chain_id})...`);
        console.log(`Deployer address: ${wallet.address}`);

        // Check wallet balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`Wallet balance: ${ethers.formatEther(balance)} ${chainConfig.native_currency_symbol}`);

        if (balance === 0n) {
            throw new Error(`No funds available on ${chainConfig.network_name}`);
        }

        // Create contract factory
        const factory = new ethers.ContractFactory(
            contractABI,
            contractBytecode,
            wallet
        );

        // Deploy contract
        const contract = await factory.deploy();
        await contract.waitForDeployment();

        const deployedAddress = await contract.getAddress();
        console.log(`Contract deployed to: ${deployedAddress}`);
        console.log(`View on Explorer: ${chainConfig.explorer_url}address/${deployedAddress}`);

        // Update the chain config with the new address immediately after deployment
        console.log('\nUpdating chain configuration with new contract address...');
        chainConfig.abtc_address = deployedAddress;
        fs.writeFileSync(
            './chain_chains_manual.json',
            JSON.stringify(chainConfigs, null, 2)
        );
        console.log('Chain configuration updated successfully');

        // Initialize NEAR for ownership acceptance
        const near = new Near(
            nearConfig.nodeUrl,
            nearConfig.accountId,
            nearConfig.contractId,
            nearConfig.pk,
            nearConfig.networkId,
            nearConfig.gas,
            nearConfig.mpcContractId,
        );

        try {
            await near.init();
            console.log('NEAR service initialized successfully');

            // Update chain configurations on NEAR contract
            console.log('\nUpdating chain configurations on NEAR contract...');
            const chainConfigsJson = JSON.stringify(chainConfigs);
            await near.set_chain_configs_from_json({
                new_json_data: chainConfigsJson
            });
            console.log('Chain configurations updated successfully on NEAR contract');

            // Verify chain configs were updated
            console.log('Verifying chain configurations...');
            try {
                // Use the correct method name from the NEAR contract
                const chainConfigsView = await near.nearContract.view_chain_configs();
                console.log('Chain configs verified:', chainConfigsView);
            } catch (error) {
                console.log('Warning: Could not verify chain configs:', error.message);
                // Continue with deployment even if verification fails
            }

            const ethereum = new Ethereum(
                chainConfig.chain_id,
                chainConfig.chain_rpc_url,
                chainConfig.gas_limit,
                deployedAddress,
                path.resolve(__dirname, './artifacts/atBTC.abi'),
            );

            const derivationPath = chainConfig.network_type;

            // Get the public key first
            console.log('Getting NEAR MPC contract public key...');
            const publicKey = await near.nearMPCContract.public_key();
            console.log('Public key obtained:', publicKey);

            // Derive the sender address
            console.log('Deriving sender address...');
            const sender = await ethereum.deriveEthAddress(
                publicKey,
                near.contract_id,
                derivationPath,
            );
            console.log("Sender address:", sender);

            // Check sender's balance
            const senderBalance = await provider.getBalance(sender);
            console.log(`Sender balance: ${ethers.formatEther(senderBalance)} ${chainConfig.native_currency_symbol}`);

            // If sender has no funds, send 0.01 from deployer
            if (senderBalance === 0n) {
                console.log(`Sender has no funds. Sending 0.01 ${chainConfig.native_currency_symbol} from deployer...`);
                const gasPrice = await provider.getFeeData();
                const sendTx = await wallet.sendTransaction({
                    to: sender,
                    value: ethers.parseEther("0.01"),
                    gasLimit: 21000,
                    maxFeePerGas: gasPrice.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
                    nonce: await provider.getTransactionCount(wallet.address)
                });
                console.log("Sending transaction...");
                const receipt = await sendTx.wait();
                console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
                console.log(`Gas used: ${receipt.gasUsed.toString()}`);
                console.log(`Sent 0.01 ${chainConfig.native_currency_symbol} to sender`);
            }

            // Transfer ownership to sender address
            console.log(`\nTransferring ownership to: ${sender}`);
            const transferTx = await contract.transferOwnership(sender);
            console.log('Waiting for ownership transfer transaction...');
            await transferTx.wait();
            console.log('Ownership transferred successfully');
            
            // Wait a bit to ensure the transaction is confirmed
            console.log('Waiting for transaction confirmation...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verify ownership transfer
            console.log('Verifying ownership transfer...');
            const pendingOwner = await contract.pendingOwner();
            console.log('Pending owner:', pendingOwner);
            if (pendingOwner.toLowerCase() !== sender.toLowerCase()) {
                throw new Error('Ownership transfer verification failed - pending owner mismatch');
            }
            
            console.log('\nAccepting ownership using MPC contract...');
            console.log('Creating accept ownership transaction...');
            
            // Get current owner before accepting
            const currentOwner = await contract.owner();
            console.log('Current owner before accept:', currentOwner);
            
            const signedTransaction = await ethereum.createAcceptOwnershipTx(
                near,
                sender,
            );

            // Convert the signed transaction to a hex string for logging
            const hexcode = Array.from(signedTransaction)
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("");

            console.log("Transaction hex:", hexcode);

            // Send the transaction
            console.log('Sending accept ownership transaction...');
            const { txnHash, status } = await ethereum.relayTransaction(signedTransaction);
            console.log("Transaction hash:", txnHash);
            console.log("Transaction status:", status);

            // Wait for transaction confirmation
            console.log('Waiting for transaction confirmation...');
            const receipt = await provider.waitForTransaction(txnHash);
            console.log("Transaction confirmed in block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());

            // Verify final ownership
            console.log('Verifying final ownership...');
            const finalOwner = await contract.owner();
            console.log('Final owner:', finalOwner);
            if (finalOwner.toLowerCase() !== sender.toLowerCase()) {
                throw new Error('Ownership acceptance verification failed - owner mismatch');
            }

            return deployedAddress;
        } catch (error) {
            console.error('Failed to initialize NEAR service or update chain configs:', error);
            throw error;
        }
    } catch (error) {
        console.error(`Error deploying to ${chainConfig.network_name} (${chainConfig.chain_id}):`, error);
        throw error;
    }
}

async function deployNearContract() {
    try {
        console.log('\nChecking NEAR contract status...');
        console.log('Contract ID:', process.env.NEAR_CONTRACT_ID);
        console.log('Master Account:', process.env.NEAR_ACCOUNT_ID);
        
        // Check if account exists and has NEAR tokens
        try {
            const accountState = execSync(`near state ${process.env.NEAR_CONTRACT_ID}`, { 
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            }).toString();
            
            console.log('Account state:', accountState);
            
            // Parse the account state to get balance
            const balanceMatch = accountState.match(/amount: '([^']+)'/);
            const balance = balanceMatch ? balanceMatch[1] : '0';
            console.log('Account balance:', balance);
            
            // Check if contract is deployed by looking at code_hash
            const codeHashMatch = accountState.match(/code_hash: '([^']+)'/);
            const codeHash = codeHashMatch ? codeHashMatch[1] : null;
            
            if (codeHash && codeHash !== '11111111111111111111111111111111') {
                console.log('Contract already deployed with code hash:', codeHash);
                
                // Check if contract is initialized by trying to view chain configs
                try {
                    const viewResult = execSync(`near view ${process.env.NEAR_CONTRACT_ID} get_chain_configs`, {
                        stdio: 'pipe',
                        env: {
                            ...process.env,
                            NEAR_ENV: 'testnet'
                        }
                    }).toString();
                    console.log('Contract is already initialized');
                    return true;
                } catch (viewError) {
                    console.log('Contract is deployed but not initialized. Proceeding with initialization...');
                }
            } else {
                // If account exists but no contract, proceed with deployment
                console.log('Account exists but no contract deployed. Proceeding with deployment...');
            }
        } catch (error) {
            console.log('Account does not exist, creating new account...');
            try {
                // Create account using the basic command
                const createAccountCmd = `near create-account ${process.env.NEAR_CONTRACT_ID} --masterAccount ${process.env.NEAR_ACCOUNT_ID} --initialBalance 10`;
                console.log('Executing command:', createAccountCmd);
                
                const result = execSync(createAccountCmd, { 
                    stdio: 'pipe',
                    env: {
                        ...process.env,
                        NEAR_ENV: 'testnet'
                    }
                });
                
                console.log('Account creation output:', result.toString());
            } catch (createError) {
                console.error('Account creation failed:', createError.message);
                throw createError;
            }
        }
        
        // Deploy NEAR contract
        console.log('Deploying NEAR contract...');
        const wasmPath = path.resolve(__dirname, './target/wasm32-unknown-unknown/release/atlas_protocol.wasm');
        
        if (!fs.existsSync(wasmPath)) {
            throw new Error(`NEAR contract WASM file not found at: ${wasmPath}`);
        }

        console.log('Found WASM file at:', wasmPath);
        console.log('WASM file size:', (fs.statSync(wasmPath).size / 1024).toFixed(2), 'KB');

        // Deploy the contract using near command
        console.log('Deploying contract to NEAR network...');
        try {
            const deployCmd = `near deploy ${process.env.NEAR_CONTRACT_ID} ${wasmPath} --accountId ${process.env.NEAR_ACCOUNT_ID}`;
            console.log('Executing command:', deployCmd);
            
            const deployResult = execSync(deployCmd, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            });
            
            console.log('Deployment output:', deployResult.toString());
            console.log('NEAR contract deployed successfully');
        } catch (deployError) {
            console.error('Contract deployment failed:', deployError.message);
            if (deployError.stderr) {
                console.error('Deployment error details:', deployError.stderr.toString());
            }
            throw deployError;
        }

        // Initialize contract with parameters using the sample command
        console.log('Initializing contract with parameters...');
        try {
            const initParams = {
                atlas_owner_id: process.env.NEAR_ATLAS_OWNER_ID,
                atlas_admin_id: process.env.NEAR_ATLAS_ADMIN_ID,
                global_params_owner_id: process.env.NEAR_GLOBAL_PARAMS_OWNER_ID,
                chain_configs_owner_id: process.env.NEAR_CHAIN_CONFIGS_OWNER_ID,
                treasury_address: process.env.NEAR_TREASURY_ADDRESS,
                production_mode: process.env.NEAR_PRODUCTION_MODE === 'true'
            };
            
            // Escape the JSON string for shell command
            const escapedJson = JSON.stringify(initParams).replace(/"/g, '\\"');
            const initCmd = `near call ${process.env.NEAR_CONTRACT_ID} new "${escapedJson}" --accountId ${process.env.NEAR_ACCOUNT_ID}`;
            console.log('Executing command:', initCmd);
            
            const initResult = execSync(initCmd, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            });
            
            console.log('Initialization output:', initResult.toString());
            console.log('Contract initialized successfully with parameters');
            
            // Save parameters to .env.local
            const envContent = fs.readFileSync('.env.local', 'utf8');
            const envLines = envContent.split('\n');
            
            // Add or update parameters
            const newParams = {
                'NEAR_ATLAS_OWNER_ID': process.env.NEAR_ATLAS_OWNER_ID,
                'NEAR_ATLAS_ADMIN_ID': process.env.NEAR_ATLAS_ADMIN_ID,
                'NEAR_GLOBAL_PARAMS_OWNER_ID': process.env.NEAR_GLOBAL_PARAMS_OWNER_ID,
                'NEAR_CHAIN_CONFIGS_OWNER_ID': process.env.NEAR_CHAIN_CONFIGS_OWNER_ID,
                'NEAR_TREASURY_ADDRESS': process.env.NEAR_TREASURY_ADDRESS,
                'NEAR_PRODUCTION_MODE': process.env.NEAR_PRODUCTION_MODE
            };

            for (const [key, value] of Object.entries(newParams)) {
                const existingIndex = envLines.findIndex(line => line.startsWith(`${key}=`));
                if (existingIndex >= 0) {
                    envLines[existingIndex] = `${key}=${value}`;
                } else {
                    envLines.push(`${key}=${value}`);
                }
            }

            fs.writeFileSync('.env.local', envLines.join('\n'));
            console.log('Parameters saved to .env.local');
        } catch (initError) {
            console.error('Contract initialization failed:', initError.message);
            if (initError.stderr) {
                console.error('Initialization error details:', initError.stderr.toString());
            }
            throw initError;
        }

        // Verify deployment
        console.log('Verifying contract deployment...');
        try {
            const verifyCmd = `near state ${process.env.NEAR_CONTRACT_ID}`;
            const verifyResult = execSync(verifyCmd, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            }).toString();
            
            const codeHashMatch = verifyResult.match(/code_hash: '([^']+)'/);
            const codeHash = codeHashMatch ? codeHashMatch[1] : null;
            
            if (!codeHash || codeHash === '11111111111111111111111111111111') {
                throw new Error('Contract deployment failed - code hash is empty');
            }
            
            console.log('Contract deployment verified successfully');
            console.log('Contract account:', process.env.NEAR_CONTRACT_ID);
            console.log('Contract code hash:', codeHash);
        } catch (verifyError) {
            console.error('Contract verification failed:', verifyError.message);
            if (verifyError.stderr) {
                console.error('Verification error details:', verifyError.stderr.toString());
            }
            throw verifyError;
        }

        return true;
    } catch (error) {
        console.error('Failed to deploy NEAR contract:', error);
        console.error('Error details:', error.message);
        if (error.stderr) {
            console.error('Error output:', error.stderr.toString());
        }
        throw error;
    }
}

async function deployNearToken() {
    try {
        // Get the NEAR testnet config from chain_chains_manual.json
        const nearTestnetConfig = chainConfigs.chains.find(chain => chain.chain_id === "NEAR_TESTNET");
        if (!nearTestnetConfig) {
            throw new Error('NEAR_TESTNET configuration not found in chain_chains_manual.json');
        }

        const tokenContractId = nearTestnetConfig.abtc_address;
        const masterAccountId = process.env.NEAR_ACCOUNT_ID;

        if (!tokenContractId || !masterAccountId) {
            throw new Error('Missing required configuration: tokenContractId or masterAccountId');
        }

        console.log('\nDeploying NEAR token contract...');
        console.log('Token Contract ID:', tokenContractId);
        console.log('Master Account:', masterAccountId);

        // Check if token account exists
        try {
            const accountState = execSync(`near state ${tokenContractId}`, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            }).toString();

            const codeHashMatch = accountState.match(/code_hash: '([^']+)'/);
            const codeHash = codeHashMatch ? codeHashMatch[1] : null;

            if (codeHash && codeHash !== '11111111111111111111111111111111') {
                console.log('Token contract already deployed with code hash:', codeHash);
                return true;
            }
        } catch (error) {
            console.log('Token account does not exist, creating new account...');
            try {
                const createAccountCmd = `near create-account ${tokenContractId} --masterAccount ${masterAccountId} --initialBalance 10`;
                console.log('Executing command:', createAccountCmd);
                
                execSync(createAccountCmd, {
                    stdio: 'pipe',
                    env: {
                        ...process.env,
                        NEAR_ENV: 'testnet'
                    }
                });
                
                console.log('Token account created successfully');
            } catch (createError) {
                console.error('Token account creation failed:', createError.message);
                throw createError;
            }
        }

        // Deploy the token contract
        console.log('Deploying token contract...');
        const wasmPath = path.resolve(__dirname, './res/atbtc.wasm');
        
        if (!fs.existsSync(wasmPath)) {
            throw new Error(`Token contract WASM file not found at: ${wasmPath}`);
        }

        console.log('Found token WASM file at:', wasmPath);
        console.log('WASM file size:', (fs.statSync(wasmPath).size / 1024).toFixed(2), 'KB');

        try {
            const deployCmd = `near deploy ${tokenContractId} ${wasmPath} --accountId ${masterAccountId}`;
            console.log('Executing command:', deployCmd);
            
            execSync(deployCmd, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            });
            
            console.log('Token contract deployed successfully');

            // Initialize the token contract
            console.log('Initializing token contract...');
            const tokenMetadata = {
                spec: "ft-1.0.0",
                name: "Atlas BTC",
                symbol: "atBTC",
                icon: "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27100%27%20height=%27100%27%20viewBox=%270%200%20100%20100%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27%23e67e22%27/%3E%3Ctext%20x=%2750%25%27%20y=%2750%25%27%20font-family=%27Tahoma%27%20font-size=%2720%27%20font-weight=%27bold%27%20fill=%27white%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%3EatBTC%3C/text%3E%3C/svg%3E",
                reference: null,
                reference_hash: null,
                decimals: 8
            };

            const initArgs = {
                owner_id: process.env.NEAR_CONTRACT_ID,
                metadata: tokenMetadata
            };

            const initCmd = `near call ${tokenContractId} new '${JSON.stringify(initArgs)}' --accountId ${masterAccountId}`;
            console.log('Executing command:', initCmd);
            
            execSync(initCmd, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            });
            
            console.log('Token contract initialized successfully');

            // Verify deployment
            console.log('Verifying token contract deployment...');
            const verifiedMetadata = execSync(`near view ${tokenContractId} ft_metadata`, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NEAR_ENV: 'testnet'
                }
            }).toString();
            
            console.log('Token metadata:', verifiedMetadata);
            return true;
        } catch (error) {
            console.error('Token contract deployment failed:', error.message);
            if (error.stderr) {
                console.error('Deployment error details:', error.stderr.toString());
            }
            throw error;
        }
    } catch (error) {
        console.error('Failed to deploy NEAR token contract:', error);
        throw error;
    }
}

async function main() {
    // Get private key from .env.local
    const evmPrivateKey = process.env.EVM_PRIVATE_KEY;
    if (!evmPrivateKey) {
        console.error('EVM_PRIVATE_KEY not found in .env.local');
        process.exit(1);
    }

    // Deploy NEAR contract first
    try {
        await deployNearContract();
        
        // Deploy NEAR token contract after main contract
        console.log('\nProceeding with NEAR token contract deployment...');
        await deployNearToken();
    } catch (error) {
        console.error('NEAR contract deployment failed. Please fix the issues and try again.');
        process.exit(1);
    }

    // Create wallet to check balances
    const wallet = new ethers.Wallet(evmPrivateKey);
    console.log('\nChecking wallet balances...');
    console.log('Wallet address:', wallet.address);
    
    // Filter chains that need deployment (blank abtc_address and not Bitcoin networks)
    const chainsToDeploy = chainConfigs.chains.filter(chain => 
        !chain.abtc_address && 
        !chain.network_name.includes('Bitcoin')
    );
    
    if (chainsToDeploy.length === 0) {
        console.log('\nNo chains need deployment. All chains already have contracts deployed or are Bitcoin networks.');
        return;
    }

    console.log(`\nFound ${chainsToDeploy.length} chains that need deployment:`);
    chainsToDeploy.forEach(chain => {
        console.log(`- ${chain.network_name} (${chain.chain_id})`);
    });
    
    // Check balances on chains that need deployment
    const balances = await checkWalletBalances(wallet, { chains: chainsToDeploy });
    console.log('\nWallet balances:');
    for (const [network, balance] of Object.entries(balances)) {
        console.log(`${network}: ${balance}`);
        if (parseFloat(balance) === 0) {
            console.error(`WARNING: No funds available on ${network}`);
            console.error('Please fund the wallet before proceeding with deployment');
            process.exit(1);
        }
    }

    // Deploy to each chain that needs deployment
    for (const chain of chainsToDeploy) {
        if (chain.network_type === 'EVM') {
            try {
                await deployContract(chain, evmPrivateKey);
            } catch (error) {
                console.error(`Failed to deploy to ${chain.network_name}`);
            }
        }
    }

    // Save updated chain configurations
    fs.writeFileSync(
        './chain_chains_manual.json',
        JSON.stringify(chainConfigs, null, 2)
    );
    console.log('\nChain configurations updated with new contract addresses');
}

main().catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
});