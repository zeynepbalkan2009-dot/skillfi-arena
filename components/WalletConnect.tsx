"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Thin wrapper rather than using <ConnectButton /> directly inline
 * everywhere: if the design changes (e.g. swapping to a custom button via
 * ConnectButton.Custom) there's exactly one place to do it.
 */
export function WalletConnect() {
  return (
    <ConnectButton
      label="Connect Wallet"
      chainStatus="icon"
      showBalance={{ smallScreen: false, largeScreen: true }}
      accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
    />
  );
}
