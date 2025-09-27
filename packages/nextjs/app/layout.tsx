import dynamic from "next/dynamic";
import MiniKitProvider from "../components/minikit-provider";
import "@rainbow-me/rainbowkit/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Scaffold-ETH 2 App",
  description: "Built with 🏗 Scaffold-ETH 2",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  const ErudaProvider = dynamic(() => import("../components/Eruda").then(c => c.ErudaProvider), {
    ssr: false,
  });
  return (
    <html suppressHydrationWarning>
      {/* <ErudaProvider> */}
      <MiniKitProvider>
        <body>
          <ThemeProvider enableSystem>
            <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
          </ThemeProvider>
        </body>
      </MiniKitProvider>
      {/* </ErudaProvider> */}
    </html>
  );
};

export default ScaffoldEthApp;
