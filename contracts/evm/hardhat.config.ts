import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";

// Networks per docs/SMART_CONTRACTS.md — confirmed RPCs/chain IDs from
// 0g_context.md. Mainnet (Aristotle) is real; there is no Miden equivalent,
// which is exactly why the registries live here and not on a Miden account.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    zg_testnet: {
      url: process.env.ZG_RPC_URL_TESTNET ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
    zg_mainnet: {
      url: process.env.ZG_RPC_URL_MAINNET ?? "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
  },
};

export default config;
