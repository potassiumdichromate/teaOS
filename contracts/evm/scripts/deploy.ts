import { ethers, network } from "hardhat";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Deploys all 5 registries and writes their addresses to
// contracts/evm/deployments/<network>.json — copy those values into .env
// (QUESTION_REGISTRY_ADDRESS etc.) per docs/0G_INTEGRATION.md. Never
// hardcode an address in application code, per docs/SMART_CONTRACTS.md.
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying registries on ${network.name} as ${deployer.address}`);

  const names = ["QuestionRegistry", "PaperRegistry", "SubmissionRegistry", "ResultRegistry", "AuditLogRegistry"] as const;
  const addresses: Record<string, string> = {};

  for (const name of names) {
    const factory = await ethers.getContractFactory(name);
    const contract = await factory.deploy(deployer.address);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    addresses[name] = address;
    console.log(`${name} deployed to ${address}`);
  }

  const outDir = join(__dirname, "..", "deployments");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${network.name}.json`), JSON.stringify(addresses, null, 2));
  console.log(`Addresses written to deployments/${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
