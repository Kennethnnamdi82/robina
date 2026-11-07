import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { Web3Provider } from "./providers/Web3Provider";
import { PrivyProvider } from "@privy-io/react-auth";
import type {ReactNode} from 'react';
import {isNativeAndroid} from '@/native/platform';
import NativeShell from '@/native/NativeShell';
import NativeBrowserHandoff from '@/native/NativeBrowserHandoff';
import NativeUpdateNotice from '@/native/NativeUpdateNotice';

import AppRoutes from "@/routes/AppRoutes";

const queryClient = new QueryClient();
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
function IdentityBoundary({children}:{children:ReactNode}){
  return isNativeAndroid()?children:<PrivyProvider appId={privyAppId||'unconfigured'} config={{loginMethods:['google']}}><Web3Provider>{children}</Web3Provider></PrivyProvider>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <IdentityBoundary>
        <TooltipProvider>
          <Sonner position="top-center" theme="dark" richColors closeButton />
          <BrowserRouter>
            <AuthProvider>
              <NativeShell/>
              <NativeUpdateNotice/>
              <NativeBrowserHandoff>
              <div className="min-h-screen bg-background">
                <AppRoutes />
              </div>
              </NativeBrowserHandoff>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
    </IdentityBoundary>
  </QueryClientProvider>
);

export default App;
