import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { Web3Provider } from "./providers/Web3Provider";
import { PrivyProvider } from "@privy-io/react-auth";

import AppRoutes from "@/routes/AppRoutes";

const queryClient = new QueryClient();
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PrivyProvider appId={privyAppId || "unconfigured"} config={{ loginMethods: ["google"] }}>
      <Web3Provider>
        <TooltipProvider>
          <Sonner position="top-center" theme="dark" richColors closeButton />
          <BrowserRouter>
            <AuthProvider>
              <div className="min-h-screen bg-background">
                <AppRoutes />
              </div>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </Web3Provider>
    </PrivyProvider>
  </QueryClientProvider>
);

export default App;
