import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";

const client = createPublicClient({
  chain: hardhat,
  transport: http("http://localhost:8545"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get("address");

    if (!tokenAddress) {
      return NextResponse.json({ success: false, error: "Token address is required" }, { status: 400 });
    }

    const contract = deployedContracts[31337].TokenLaunchpad;

    // Get token info from contract
    const tokenInfo = await client.readContract({
      address: contract.address as `0x${string}`,
      abi: contract.abi,
      functionName: "tokens",
      args: [tokenAddress as `0x${string}`],
    });

    // Get token price
    const tokenPrice = await client.readContract({
      address: contract.address as `0x${string}`,
      abi: contract.abi,
      functionName: "getTokenPrice",
      args: [tokenAddress as `0x${string}`],
    });

    return NextResponse.json({
      success: true,
      data: {
        creator: tokenInfo[0],
        name: tokenInfo[1],
        symbol: tokenInfo[2],
        metadataURI: tokenInfo[3],
        virtualEthReserves: tokenInfo[4].toString(),
        virtualTokenReserves: tokenInfo[5].toString(),
        totalSupply: tokenInfo[6].toString(),
        creatorFees: tokenInfo[7].toString(),
        createdAt: tokenInfo[8].toString(),
        price: tokenPrice.toString(),
      },
    });
  } catch (error) {
    console.error("Error fetching token info:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch token info" }, { status: 500 });
  }
}
