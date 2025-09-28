"use client";

import React from "react";
import Link from "next/link";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

/**
 * Site header
 */
export const Header = () => {
  return (
    <div className="sticky top-0 navbar bg-base-100 min-h-0 flex-shrink-0 justify-between z-20 shadow-md shadow-secondary px-2 sm:px-4">
      <div className="navbar-start w-auto">
        <Link href="/" passHref>
          <img src={"/coins_of_humanity_logo.png"} className="size-8" alt="Coins of Humanity Logo" />
        </Link>
        <Link href="/" passHref className="flex items-center gap-2 ml-2 mr-4 shrink-0">
          <div className="flex flex-col">
            <span className="hidden md:block font-bold leading-tight text-lg text-gradient animate-glow">
              🚀 Coins Of Humanity
            </span>
          </div>
        </Link>
      </div>
      <div className="navbar-end">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
