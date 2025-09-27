import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
// Import the centralized launchpad configuration
import { LAUNCHPAD_CONFIG } from "~~/config/launchpad";

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

    const contract = LAUNCHPAD_CONFIG;

    // Get token info from contract
    const tokenInfo = await client.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "tokens",
      args: [tokenAddress as `0x${string}`],
    });

    // Get token price
    const tokenPrice = await client.readContract({
      address: contract.address,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, functionName, args } = body;

    if (!address || !functionName) {
      return NextResponse.json({ success: false, error: "Address and function name are required" }, { status: 400 });
    }

    let result;

    if (functionName === "balanceOf") {
      // Handle ERC20 balanceOf call
      const tokenContract = {
        address: address as `0x${string}`,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
      };

      result = await client.readContract({
        address: tokenContract.address,
        abi: tokenContract.abi,
        functionName: "balanceOf",
        args: [args[0] as `0x${string}`],
      });
    } else {
      // Handle TokenLaunchpad contract calls
      const contract = LAUNCHPAD_CONFIG;

      result = await client.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: functionName,
        args: args,
      });
    }

    return NextResponse.json({
      success: true,
      data: String(result),
    });
  } catch (error) {
    console.error("Error calling contract function:", error);
    return NextResponse.json({ success: false, error: "Failed to call contract function" }, { status: 500 });
  }
}
