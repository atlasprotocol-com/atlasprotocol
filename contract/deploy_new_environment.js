const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Read the chain configurations
const chainConfigs = JSON.parse(fs.readFileSync('./chain_chains_manual.json', 'utf8'));

// Read the contract ABI
const contractABI = JSON.parse(fs.readFileSync('./tokens/solidity_contract/artifacts/atBTC.abi', 'utf8'));

// Read the contract bytecode
const contractBytecode = fs.readFileSync('./tokens/solidity_contract/artifacts/atBTC.bin', 'utf8');

async function deployContract(chainConfig, privateKey) {
    try {
        // Create provider and wallet
        const provider = new ethers.JsonRpcProvider(chainConfig.chain_rpc_url);
        const wallet = new ethers.Wallet(privateKey, provider);

        console.log(`\nDeploying to ${chainConfig.network_name} (${chainConfig.chain_id})...`);
        console.log(`Deployer address: ${wallet.address}`);

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

        // Update the chain config with the new address
        chainConfig.abtc_address = deployedAddress;

        return deployedAddress;
    } catch (error) {
        console.error(`Error deploying to ${chainConfig.network_name}:`, error);
        throw error;
    }
}

async function main() {
    // Get private key from command line or environment variable
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error('Please provide your private key as an environment variable: PRIVATE_KEY');
        process.exit(1);
    }

    // Deploy to each EVM chain
    for (const chain of chainConfigs.chains) {
        if (chain.network_type === 'EVM') {
            try {
                await deployContract(chain, privateKey);
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